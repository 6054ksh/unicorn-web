export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

/**
 * 요청: { roomId, thumbsForUid|null, heartForUid|null, noshowUid: 'none'|uid }
 * 정책:
 *  - 사용자별 해당 room 투표는 1회만 허용
 *  - thumbs/heart는 해당 사용자 점수 +1씩 누적(원하시면 가중치 바꾸세요)
 *  - noshowUid는 -20점 (또는 규칙대로)
 */
export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const body = await req.json();
    const roomId = String(body?.roomId || '').trim();
    const thumbsForUid = (body?.thumbsForUid && String(body.thumbsForUid)) || null;
    const heartForUid = (body?.heartForUid && String(body.heartForUid)) || null;
    const noshowUid = String(body?.noshowUid || 'none');

    if (!roomId) throw httpError('roomId required', 400);

    const roomRef = db.collection('rooms').doc(roomId);
    const voteRef = roomRef.collection('votes').doc(uid);

    // 이미 투표했는지 확인
    const vsnap = await voteRef.get();
    if (vsnap.exists) {
      return NextResponse.json({ ok: true, already: true });
    }

    // 방 검증/상태 체크
    const rsnap = await roomRef.get();
    if (!rsnap.exists) throw httpError('room-not-found', 404);
    const rdata = rsnap.data() as any;

    const now = new Date();
    const ended = rdata?.endAt ? now >= new Date(rdata.endAt) : false;
    if (!ended) throw httpError('room-not-ended', 400); // 종료 이후만 투표 허용(요구사항)

    // 참가자인지 확인(옵션)
    const participants: string[] = Array.isArray(rdata?.participants) ? rdata.participants : [];
    if (!participants.includes(uid)) throw httpError('not-a-participant', 403);

    // 점수 반영 트랜잭션
    await db.runTransaction(async (tx) => {
      // 한 번 더 존재 확인(경합 방지)
      const check = await tx.get(voteRef);
      if (check.exists) throw httpError('already-voted', 409);

      // 투표 저장
      tx.set(voteRef, {
        by: uid,
        thumbsForUid,
        heartForUid,
        noshowUid,
        submittedAt: now.toISOString(),
      });

      // 점수 반영
      const scores = db.collection('scores');

      if (thumbsForUid) {
        tx.set(
          scores.doc(thumbsForUid),
          {
            total: admin.firestore.FieldValue.increment(1),
            thumbsCount: admin.firestore.FieldValue.increment(1),
            lastUpdatedAt: now.toISOString(),
          },
          { merge: true }
        );
      }
      if (heartForUid) {
        tx.set(
          scores.doc(heartForUid),
          {
            total: admin.firestore.FieldValue.increment(1),
            heartsCount: admin.firestore.FieldValue.increment(1),
            lastUpdatedAt: now.toISOString(),
          },
          { merge: true }
        );
      }
      if (noshowUid && noshowUid !== 'none') {
        tx.set(
          scores.doc(noshowUid),
          {
            total: admin.firestore.FieldValue.increment(-20),
            lastUpdatedAt: now.toISOString(),
          },
          { merge: true }
        );
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
