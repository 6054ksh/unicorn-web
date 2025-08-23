// src/app/api/rooms/join/route.ts
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
    const userRef = db.collection('users').doc(uid);
    const scoreRef = db.collection('scores').doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) throw httpError('room-not-found', 404);

      const data = snap.data() as any;
      const now = new Date();
      const endAt = toDate(data?.endAt);

      if (data?.closed === true) throw httpError('room-closed', 400);
      if (endAt && now >= endAt) throw httpError('room-ended', 400);

      const participants: string[] = Array.isArray(data?.participants) ? data.participants : [];
      if (participants.includes(uid)) return; // 멱등

      const cap = typeof data?.capacity === 'number' ? data.capacity : undefined;
      if (cap && participants.length >= cap) throw httpError('room-full', 409);

      // append
      participants.push(uid);

      tx.update(roomRef, {
        participants,
        participantsCount: participants.length,
        updatedAt: now.toISOString(),
      });

      // 점수 +5, joinedRooms +1
      tx.set(scoreRef, {
        uid,
        total: FieldValue.increment(5),
        joinedRooms: FieldValue.increment(1),
        lastUpdatedAt: now.toISOString(),
      }, { merge: true });

      // 유저 기본 프로필 업데이트(있을 때만 merge)
      const name = decoded.name || '';
      const picture = decoded.picture || '';
      if (name || picture) {
        tx.set(userRef, {
          uid, name, profileImage: picture, updatedAt: now.toISOString(),
        }, { merge: true });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.status ?? 500;
    const msg = e?.message ?? String(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
