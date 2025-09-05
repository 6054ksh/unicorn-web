import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();
    const msging = getAdminMessaging();

    // 인증
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);
    const { uid } = await auth.verifyIdToken(idToken);

    // 페이로드
    let body: any = {};
    try { body = await req.json(); } catch {}
    const title = (body?.title || '테스트 알림').toString();
    const bodyText = (body?.body || 'UNIcorn 알림이 잘 오는지 확인해요!').toString();

    // 내 fcmTokens
    const userSnap = await db.collection('users').doc(uid).get();
    const arr: string[] = Array.isArray(userSnap.data()?.fcmTokens) ? userSnap.data()!.fcmTokens : [];
    const tokens = arr.filter(Boolean);
    if (tokens.length === 0) throw httpError('no-tokens', 400);

    const base = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL || ''}` || '';
    const link = base ? `${base}/` : '/';

    // 멀티캐스트(500개씩)
    let success = 0, failure = 0;
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      const res = await msging.sendEachForMulticast({
        tokens: chunk,
        webpush: {
          headers: { Urgency: 'high', TTL: '120' },
          fcmOptions: { link },
          notification: { title, body: bodyText, tag: 'test-noti', renotify: true },
        },
        data: { url: link },
      });
      success += res.successCount;
      failure += res.failureCount;

      // 불량 토큰 정리
      const bad: string[] = [];
      res.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = (r.error as any)?.code || '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
            bad.push(chunk[idx]);
          }
        }
      });
      if (bad.length) {
        await db
          .collection('users')
          .doc(uid)
          .update({ fcmTokens: (userSnap.data()?.fcmTokens || []).filter((t: string) => !bad.includes(t)) });
      }
    }

    return NextResponse.json({ ok: true, success, failure });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
