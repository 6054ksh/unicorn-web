// src/app/api/notifications/test-send/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const msging = getAdminMessaging();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const body = await req.json().catch(() => ({}));
    const title = body?.title || '테스트 알림';
    const bodyText = body?.body || 'UNIcorn에서 보낸 테스트 메시지입니다.';
    const url = body?.url || '/';

    const userDoc = await db.collection('users').doc(uid).get();
    const tokens: string[] = Array.isArray(userDoc.data()?.fcmTokens) ? userDoc.data()!.fcmTokens : [];
    if (!tokens.length) return NextResponse.json({ error: 'no-tokens' }, { status: 400 });

    const res = await msging.sendEachForMulticast({
      tokens,
      notification: { title, body: bodyText },
      data: { url },
    });

    return NextResponse.json({ ok: true, successCount: res.successCount, failureCount: res.failureCount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
