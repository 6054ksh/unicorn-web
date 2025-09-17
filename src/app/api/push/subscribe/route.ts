export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const db = getAdminDb();
    const { token, ua } = await req.json().catch(() => ({}));
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

    const ref = db.collection('broadcastTokens').doc(token);
    await ref.set(
      {
        token,
        ua: ua || '',
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        enabled: true,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
