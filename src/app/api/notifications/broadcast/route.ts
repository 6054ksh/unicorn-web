import { NextResponse } from 'next/server';
import { adminAuth, adminDb, adminMessaging } from '@/lib/firebaseAdmin';

async function assertAdmin(uid: string) {
  const d = await adminDb.collection('admins').doc(uid).get();
  if (!d.exists || !d.data()?.isAdmin) throw new Error('forbidden');
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);
    await assertAdmin(uid);

    const { title, body } = await req.json();
    const usersSnap = await adminDb.collection('users').get();
    const tokens: string[] = [];
    usersSnap.forEach(d => {
      const v = d.data() as any;
      const tks = Array.isArray(v?.tokens) ? v.tokens : [];
      tks.forEach((t: string) => { if (t && !tokens.includes(t)) tokens.push(t); });
    });

    if (!tokens.length) return NextResponse.json({ ok: true, sent: 0 });

    const res = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: { title: title || '테스트', body: body || '테스트 메시지입니다.' },
    });

    return NextResponse.json({ ok: true, sent: res.successCount });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    return NextResponse.json({ error: msg }, { status: msg === 'forbidden' ? 403 : 500 });
  }
}
