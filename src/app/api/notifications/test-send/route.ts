// src/app/api/notifications/test-send/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';

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
    const title = body?.title || '테스트 알림';
    const bodyText = body?.body || 'UNIcorn에서 보낸 테스트 메시지입니다.';
    const url = body?.url || '/';

    const userDoc = await db.collection('users').doc(uid).get();
    const tokens: string[] = Array.isArray(userDoc.data()?.fcmTokens) ? userDoc.data()!.fcmTokens : [];
    if (!tokens.length) return NextResponse.json({ error: 'no-tokens' }, { status: 400 });

    // ✅ WebPush 헤더로 지연 최소화
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body: bodyText },
      data: { url },
      webpush: {
        headers: {
          Urgency: 'high',       // 중요도 높임
          TTL: '60',             // 60초 지나면 폐기(오래 큐에 머무르지 않음)
        },
        fcmOptions: {
          link: url,             // 탭/앱으로 딥링크
        },
      },
    });

    return NextResponse.json({ ok: true, successCount: res.successCount, failureCount: res.failureCount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
