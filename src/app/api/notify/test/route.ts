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
    const userDoc = await db.collection('users').doc(uid).get();
    const tokens: string[] = userDoc.get('tokens') || [];
    if (!tokens.length) {
      return NextResponse.json({ error: 'no-tokens' }, { status: 400 });
    }

    const messaging = getAdminMessaging();
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: 'UNIcorn 알림 테스트',
        body: '이 브라우저에서 푸시가 잘 도착하면 성공!',
      },
      data: { kind: 'test' },
    });

    return NextResponse.json({ ok: true, successCount: res.successCount, failureCount: res.failureCount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
