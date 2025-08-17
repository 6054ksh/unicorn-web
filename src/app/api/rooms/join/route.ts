import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 인증 토큰
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    // 요청 본문
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw httpError('invalid-json', 400);
    }
    const roomId = body?.roomId;
    if (!roomId) throw httpError('roomId required', 400);

    const roomRef = db.collection('rooms').doc(roomId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) throw httpError('room-not-found', 404);

      const data = snap.data() as any;
      const now = new Date();

      // 종료/만료 체크
      if (data?.closed === true) throw httpError('room-closed', 400);
      if (data?.endAt && now >= new Date(data.endAt)) throw httpError('room-ended', 400);

      // 개설 후 10분간 참여 잠금 같은 정책(옵션): joinLockUntil 전에면 막기
      if (data?.joinLockUntil && now < new Date(data.joinLockUntil)) {
        throw httpError('join-locked', 400);
      }

      // 중복 참여 방지
      const participants: string[] = Array.isArray(data?.participants) ? data.participants : [];
      if (participants.includes(uid)) {
        // 이미 참여 중이면 그냥 성공 처리(멱등)
        return;
      }

      // 정원 확인
      const cap = typeof data?.capacity === 'number' ? data.capacity : undefined;
      if (cap && participants.length >= cap) throw httpError('room-full', 409);

      participants.push(uid);

      tx.update(roomRef, {
        participants,
        participantsCount: participants.length,
        updatedAt: now.toISOString(),
      });

      // (선택) 점수 +5 같은 로직이 필요하면 여기서 users/{uid} 또는 scores 컬렉션에 increment 처리 추가
      // 예) tx.set(db.collection('scores').doc(uid), { score: admin.firestore.FieldValue.increment(5) }, { merge: true })
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.status ?? 500;
    const msg = e?.message ?? String(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
