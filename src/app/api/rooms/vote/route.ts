import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

// thumbs/heart는 점수판에서 총합 표기용(집계 컬럼)
export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);

    let body: any = {};
    try { body = await req.json(); } catch { throw httpError('invalid-json', 400); }

    const roomId = String(body?.roomId || '').trim();
    const thumbsForUid = body?.thumbsForUid ? String(body.thumbsForUid) : '';
    const heartForUid  = body?.heartForUid  ? String(body.heartForUid)  : '';
    const noshowUid    = body?.noshowUid    ? String(body.noshowUid)    : 'none';
    if (!roomId) throw httpError('roomId required', 400);

    const roomRef = db.collection('rooms').doc(roomId);
    const res = await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) throw httpError('room-not-found', 404);
      const r = snap.data() as any;

      const participants: string[] = Array.isArray(r.participants) ? r.participants : [];
      if (!participants.includes(uid)) throw httpError('not-a-participant', 403);

      // 종료 후 24h 동안만 허용
      const now = new Date();
      const end = new Date(r.endAt);
      if (now < end) throw httpError('vote-not-open', 400);
      if (now.getTime() > end.getTime() + 24 * 60 * 60 * 1000) throw httpError('vote-closed', 400);

      // 이미 투표했는지
      const voted: string[] = Array.isArray(r.voteDoneUids) ? r.voteDoneUids : [];
      if (voted.includes(uid)) {
        // 멱등 처리: 이미 완료 → 성공 리턴
        return { already: true, allClosed: !!r.closed };
      }

      // 투표 집계
      const updates: any = {
        voteOpen: true,
        voteDoneUids: FieldValue.arrayUnion(uid),
        updatedAt: now.toISOString(),
      };

      // 칭찬(따봉/하트) 카운트
      const incThumbs = thumbsForUid && participants.includes(thumbsForUid);
      const incHearts = heartForUid  && participants.includes(heartForUid);

      if (incThumbs) {
        tx.set(db.collection('scores').doc(thumbsForUid), { thumbsCount: FieldValue.increment(1) }, { merge: true });
      }
      if (incHearts) {
        tx.set(db.collection('scores').doc(heartForUid), { heartsCount: FieldValue.increment(1) }, { merge: true });
      }

      // 노쇼 투표는 집계만 기록(별도 컬렉션)
      if (noshowUid && noshowUid !== 'none' && participants.includes(noshowUid)) {
        const logRef = db.collection('rooms').doc(roomId).collection('voteNoshow').doc();
        tx.set(logRef, { voter: uid, target: noshowUid, createdAt: now.toISOString() });
      }

      // 모두 투표했는지 확인
      const newCount = (voted.length + 1);
      const total = participants.length || 0;
      if (total > 0 && newCount >= total) {
        updates.closed = true; // 진짜 종료
        updates.voteClosedAt = now.toISOString();
      }

      tx.update(roomRef, updates);
      return { already: false, allClosed: !!updates.closed };
    });

    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
