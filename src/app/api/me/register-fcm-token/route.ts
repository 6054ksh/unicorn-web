export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import { TOPIC_ALL_ROOMS } from '@/lib/topic';
import * as admin from 'firebase-admin';

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const messaging = getAdminMessaging();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const { token } = await req.json().catch(() => ({}));
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

    const ref = db.collection('users').doc(uid);
    await ref.set({
      uid,
      updatedAt: new Date().toISOString(),
      fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
    }, { merge: true });

    // ✅ 전체 공지 토픽 자동 구독
    await messaging.subscribeToTopic([token], TOPIC_ALL_ROOMS);

    return NextResponse.json({ ok: true, subscribedTopic: TOPIC_ALL_ROOMS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
