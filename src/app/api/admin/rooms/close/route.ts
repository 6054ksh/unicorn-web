import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

// 어드민 검증: Firestore의 admins/{uid}.isAdmin == true 여야 통과
async function assertAdmin(uid: string) {
  const adminDb = getAdminDb();
  const doc = await adminDb.collection('admins').doc(uid).get();
  if (!doc.exists || !doc.data()?.isAdmin) {
    const err: any = new Error('forbidden');
    err.status = 403;
    throw err;
  }
}

// (선택) 라우트 버전 확인용
export async function GET() {
  return NextResponse.json({ ok: true, version: 'admin/rooms/close v1' });
}

// 방 강제 종료
export async function POST(req: Request) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);

    // 어드민 확인
    await assertAdmin(uid);

    // 입력
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
    }
    const roomId = body?.roomId;
    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });

    const roomRef = adminDb.collection('rooms').doc(roomId);
    let alreadyClosed = false;

    // 트랜잭션으로 상태 변경 (읽기 먼저 → 쓰기)
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) {
        const err: any = new Error('not-found');
        err.status = 404;
        throw err;
      }
      const nowIso = new Date().toISOString();
      const data = snap.data() as any;

      if (data.closed === true) {
        alreadyClosed = true;
        tx.update(roomRef, { forcedClosedAt: nowIso }); // 이미 종료된 방에 흔적만 남김
      } else {
        tx.update(roomRef, {
          closed: true,
          endAt: nowIso,          // 즉시 종료 시간 갱신
          forcedClosedAt: nowIso, // 강제 종료 플래그/타임스탬프
        });
      }
    });

    return NextResponse.json({ ok: true, alreadyClosed });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const status = e?.status ?? (msg === 'admin-not-initialized' ? 500 : 500);
    if (msg === 'admin-not-initialized') {
      return NextResponse.json(
        { error: 'admin-not-initialized', hint: 'FIREBASE_* 환경변수 설정 및 서버 재시작 필요' },
        { status }
      );
    }
    if (msg === 'not-found') {
      return NextResponse.json({ error: 'room-not-found' }, { status: 404 });
    }
    if (msg === 'forbidden') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status });
  }
}
