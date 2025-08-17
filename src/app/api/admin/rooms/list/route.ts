import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

// 관리자 확인
async function assertAdmin(uid: string) {
  const db = getAdminDb();
  const doc = await db.collection('admins').doc(uid).get();
  if (!doc.exists || !doc.data()?.isAdmin) {
    const err: any = new Error('forbidden');
    err.status = 403;
    throw err;
  }
}

export async function GET(req: Request) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);

    await assertAdmin(uid);

    // 쿼리 파라미터: status=open|closed|all  (기본 open), limit(default 50)
    const url = new URL(req.url);
    const status = (url.searchParams.get('status') || 'open').toLowerCase();
    const limitNum = Number(url.searchParams.get('limit') || 50);

    let q: FirebaseFirestore.Query = adminDb.collection('rooms');

    if (status === 'open') {
      q = q.where('closed', '==', false);
    } else if (status === 'closed') {
      q = q.where('closed', '==', true);
    } // all 이면 필터 없음

    // ISO 문자열 정렬이 시간순과 동일하므로 startAt 기준 정렬
    q = q.orderBy('startAt', 'desc').limit(Math.max(1, Math.min(limitNum, 200)));

    const snap = await q.get();
    const rooms = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return NextResponse.json({ ok: true, status, count: rooms.length, rooms });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (msg === 'admin-not-initialized') {
      return NextResponse.json(
        { error: 'admin-not-initialized', hint: 'FIREBASE_* 환경변수 설정/서버 재시작 필요' },
        { status: 500 }
      );
    }
    if (msg === 'forbidden') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
