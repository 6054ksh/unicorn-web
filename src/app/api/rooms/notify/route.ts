// src/app/api/rooms/notify/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import { topicForRoom } from '@/lib/topic';

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const messaging = getAdminMessaging();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    // (선택) 어드민 체크
    const adminDoc = await db.collection('admins').doc(uid).get();
    if (!adminDoc.exists || !adminDoc.data()?.isAdmin) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const roomId = (body?.roomId || '').trim();
    const title = (body?.title || '').trim() || '알림';
    const text = (body?.body || '').trim() || '';
    const url = (body?.url || `/room/${roomId}`);

    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });

    const topic = topicForRoom(roomId);

    await messaging.send({
      topic,
      notification: { title, body: text },
      data: { url },
      webpush: {
        headers: { Urgency: 'high', TTL: '120' },
        fcmOptions: { link: url },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
