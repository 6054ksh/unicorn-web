import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import { topicForRoom } from '@/lib/topic';
import * as admin from 'firebase-admin';

function httpError(message: string, status = 400) { const e: any = new Error(message); e.status = status; return e; }

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const messaging = getAdminMessaging();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const body = await req.json().catch(() => ({}));
    const roomId = body?.roomId;
    if (!roomId) throw httpError('roomId required', 400);

    const roomRef = db.collection('rooms').doc(roomId);

    let joined = false;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists) throw httpError('room-not-found', 404);
      const data = snap.data() as any;
      const now = new Date();

      if (data?.closed === true) throw httpError('room-closed', 400);
      if (data?.endAt && now >= new Date(data.endAt)) throw httpError('room-ended', 400);

      const participants: string[] = Array.isArray(data?.participants) ? data.participants : [];
      if (participants.includes(uid)) return; // 멱등
      const cap = typeof data?.capacity === 'number' ? data.capacity : undefined;
      if (cap && participants.length >= cap) throw httpError('room-full', 409);

      participants.push(uid);
      joined = true;

      tx.update(roomRef, {
        participants,
        participantsCount: participants.length,
        updatedAt: now.toISOString(),
      });
    });

    if (joined) {
      // 점수 +5
      const nowIso = new Date().toISOString();
      await db.collection('scores').doc(uid).set({
        total: admin.firestore.FieldValue.increment(5),
        joinedRooms: admin.firestore.FieldValue.increment(1),
        lastUpdatedAt: nowIso,
      }, { merge: true });

      // 방 토픽 구독(선택)
      const userDoc = await db.collection('users').doc(uid).get();
      const tokens: string[] = Array.isArray(userDoc.data()?.fcmTokens) ? userDoc.data()!.fcmTokens : [];
      if (tokens.length) {
        await messaging.subscribeToTopic(tokens, topicForRoom(roomId));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
