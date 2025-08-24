export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
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

    const { title = '테스트 알림', body = 'UNIcorn 테스트', url = '/' } = await req.json().catch(() => ({}));

    const userDoc = await db.collection('users').doc(uid).get();
    const tokens: string[] = Array.isArray(userDoc.data()?.fcmTokens) ? userDoc.data()!.fcmTokens : [];
    if (!tokens.length) return NextResponse.json({ error: 'no-tokens' }, { status: 400 });

    const res = await messaging.sendEachForMulticast({
      tokens,
      webpush: {
        headers: { Urgency: 'high', TTL: '60' },
        fcmOptions: { link: url },
        notification: { title, body, tag: 'test-noti', renotify: true },
      },
      data: { url },
    });

    // 실패 토큰은 즉시 제거
    const bad: string[] = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = (r.error as any)?.code || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
          bad.push(tokens[i]);
        }
      }
    });
    if (bad.length) {
      await db.collection('users').doc(uid).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...bad),
      });
    }

    return NextResponse.json({ ok: true, successCount: res.successCount, failureCount: res.failureCount, cleaned: bad.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
