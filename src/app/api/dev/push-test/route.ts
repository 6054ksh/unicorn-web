// src/app/api/dev/push-test/route.ts
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
    if (!idToken) return NextResponse.json({ error:'unauthorized' }, { status:401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const userDoc = await db.collection('users').doc(uid).get();
    const tokens: string[] = [];
    const data = userDoc.data() || {};
    if (Array.isArray(data.fcmTokens)) tokens.push(...data.fcmTokens.filter(Boolean));

    // 서브컬렉션 지원
    const sub = await db.collection('users').doc(uid).collection('fcmTokens').get();
    sub.forEach(d => {
      const t = (d.data() as any)?.token;
      if (t) tokens.push(t);
    });

    const uniq = Array.from(new Set(tokens));
    if (!uniq.length) return NextResponse.json({ error:'no-registered-token' }, { status:400 });

    await msging.sendEachForMulticast({
      tokens: uniq,
      notification: {
        title: 'UNIcorn 알림 테스트',
        body: '이 알림이 보이면 FCM이 잘 연결되었습니다 🎉',
      },
      data: { kind: 'test', ts: String(Date.now()) },
    });

    return NextResponse.json({ ok:true, count: uniq.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status:500 });
  }
}
