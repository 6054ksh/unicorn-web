// src/app/api/rooms/leave/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}
function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  try { return new Date(v); } catch { return null; }
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = await req.json().catch(() => ({}));
    const roomId = body?.roomId;
    if (!roomId) throw httpError('roomId required', 400);

    const roomRef = db.collection('rooms').doc(roomId);
    const scoreRef = db.collection('scores').doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) throw httpError('room-not-found', 404);

      const data = snap.data() as any;
      const now = new Date();

      const start = toDate(data?.startAt);
      const end = toDate(data?.endAt);

      if (data?.closed === true || (end && now >= end)) throw httpError('room-closed-or-ended', 400);

      // 시작 1시간 전부터 나가기 금지
      if (start) {
        const leaveLockAt = new Date(start.getTime() - 60 * 60 * 1000);
        if (now >= leaveLockAt) throw httpError('leave-locked', 400);
      }

      const participants: string[] = Array.isArray(data?.participants) ? data.participants : [];
      const beforeLen = participants.length;
      const after = participants.filter((p) => p !== uid);

      if (after.length === beforeLen) return; // 멱등

      tx.update(roomRef, {
        participants: after,
        participantsCount: after.length,
        updatedAt: now.toISOString(),
      });

      // 점수 -5
      tx.set(scoreRef, {
        uid,
        total: FieldValue.increment(-5),
        lastUpdatedAt: now.toISOString(),
      }, { merge: true });
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.status ?? 500;
    const msg = e?.message ?? String(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
