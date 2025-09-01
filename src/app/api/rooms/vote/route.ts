export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { COL, VoteDoc } from '@/types/firestore';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const body = await req.json().catch(() => ({}));
    const roomId = (body?.roomId || '').trim();
    const thumbsForUid = (body?.thumbsForUid || '').trim() || null;
    const heartForUid = (body?.heartForUid || '').trim() || null;
    const noshowUidRaw = (body?.noshowUid || '').trim();
    const noshowUid = noshowUidRaw === 'none' || noshowUidRaw === '' ? 'none' : noshowUidRaw;

    if (!roomId) throw httpError('roomId required', 400);

    // 룸 검증
    const roomSnap = await db.collection(COL.rooms).doc(roomId).get();
    if (!roomSnap.exists) throw httpError('room-not-found', 404);
    const room = roomSnap.data() as any;

    const participants: string[] = Array.isArray(room?.participants) ? room.participants : [];
    const endAt = room?.endAt ? new Date(room.endAt) : null;

    // 투표 권한: 참가자만
    if (!participants.includes(uid)) throw httpError('not-participant', 403);

    // 투표 가능 시간: 종료 후 24시간 이내
    const now = new Date();
    if (!endAt || now < endAt) throw httpError('vote-not-open', 400);
    const voteDeadline = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
    if (now >= voteDeadline) throw httpError('vote-closed', 400);

    // 선택값 검증(존재/none)
    const validateTarget = (x: string | null) => {
      if (!x) return true; // 미선택 허용
      return participants.includes(x);
    };
    if (!validateTarget(thumbsForUid)) throw httpError('invalid-thumbs-target', 400);
    if (!validateTarget(heartForUid)) throw httpError('invalid-heart-target', 400);
    if (noshowUid !== 'none' && !participants.includes(noshowUid)) throw httpError('invalid-noshow-target', 400);

    const nowIso = new Date().toISOString();
    const id = `${roomId}__${uid}`;
    const ref = db.collection(COL.roomVotes).doc(id);
    const payload: VoteDoc = {
      roomId,
      voterUid: uid,
      thumbsForUid,
      heartForUid,
      noshowUid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await ref.set(payload, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
