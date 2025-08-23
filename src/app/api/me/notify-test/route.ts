// src/app/api/me/notify-test/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const auth = getAdminAuth();
    const { uid } = await auth.verifyIdToken(idToken);

    const db = getAdminDb();
    const snap = await db.collection('userFcmTokens').doc(uid).get();
    if (!snap.exists) return NextResponse.json({ error: 'no-tokens' }, { status: 404 });
    const tokens: string[] = Array.isArray((snap.data() as any).tokens) ? (snap.data() as any).tokens : [];
    if (!tokens.length) return NextResponse.json({ error: 'no-tokens' }, { status: 404 });

    const messaging = getAdminMessaging();
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: 'UNIcorn 테스트 알림',
        body: '푸시가 잘 도착하면 성공!',
      },
      data: {
        type: 'test',
        ts: String(Date.now()),
      },
    });

    return NextResponse.json({ ok: true, successCount: res.successCount, failureCount: res.failureCount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
