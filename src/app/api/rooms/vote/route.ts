import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function POST(req: Request) {
  try {
    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);
    const { uid } = await adminAuth.verifyIdToken(idToken);

    const body = await req.json();
    const roomId = String(body?.roomId || '').trim();
    if (!roomId) throw httpError('roomId required', 400);

    const thumbsForUid = body?.thumbsForUid ? String(body.thumbsForUid) : null;
    const heartForUid  = body?.heartForUid  ? String(body.heartForUid)  : null;
    const noshowUid    = body?.noshowUid    ? String(body.noshowUid)    : 'none';

    const roomRef = db.collection('rooms').doc(roomId);
    const voteRef = roomRef.collection('votes').doc(uid);

    // 1) 방 로드 + 유효성
    const rs = await roomRef.get();
    if (!rs.exists) throw httpError('room-not-found', 404);
    const r = rs.data() as any;
    const participants: string[] = Array.isArray(r?.participants) ? r.participants : [];
    if (!participants.includes(uid)) throw httpError('not-a-participant', 403);

    // 투표 가능 시간: 종료 후 24시간
    const now = new Date();
    const endAt = r?.endAt ? new Date(r.endAt) : null;
    if (!endAt) throw httpError('invalid-room-endAt', 400);
    if (now < endAt) throw httpError('vote-after-end-only', 400);
    if (now.getTime() > endAt.getTime() + 24 * 60 * 60 * 1000) throw httpError('vote-window-closed', 400);

    // 2) 1회성 보장
    const vs = await voteRef.get();
    if (vs.exists) throw httpError('already-voted', 409);

    // 대상자 유효성(참여자 중에 있어야 카운트)
    const validThumb = thumbsForUid && participants.includes(thumbsForUid) ? thumbsForUid : null;
    const validHeart = heartForUid  && participants.includes(heartForUid)  ? heartForUid  : null;
    const validNoshow = noshowUid && noshowUid !== 'none' && participants.includes(noshowUid) ? noshowUid : 'none';

    // 3) 트랜잭션: vote doc 생성 + 점수 카운트 증가
    const nowIso = new Date().toISOString();
    await db.runTransaction(async (tx) => {
      // 다시 검사(경쟁 조건)
      const exist = await tx.get(voteRef);
      if (exist.exists) throw httpError('already-voted', 409);

      tx.set(voteRef, {
        voterUid: uid,
        roomId,
        thumbsForUid: validThumb,
        heartForUid: validHeart,
        noshowUid: validNoshow || 'none',
        createdAt: nowIso,
      });

      // 카운트
      if (validThumb) {
        const sref = db.collection('scores').doc(validThumb);
        tx.set(sref, {
          thumbsCount: (global as any).admin?.firestore?.FieldValue?.increment?.(1) ?? 1,
        }, { merge: true });
      }
      if (validHeart) {
        const sref = db.collection('scores').doc(validHeart);
        tx.set(sref, {
          heartsCount: (global as any).admin?.firestore?.FieldValue?.increment?.(1) ?? 1,
        }, { merge: true });
      }
    });

    // 4) 모두 투표했는지 체크 → 플래그
    try {
      const allVotes = await roomRef.collection('votes').get();
      const votedUids = new Set(allVotes.docs.map(d => (d.data() as any)?.voterUid).filter(Boolean));
      const everyoneVoted = participants.length > 0 && participants.every(u => votedUids.has(u));
      if (everyoneVoted) {
        await roomRef.set({ voteComplete: true }, { merge: true });
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ error: e?.message ?? String(e) }, { status });
  }
}
