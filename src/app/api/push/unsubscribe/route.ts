export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const db = getAdminDb();
    const { token } = await req.json().catch(() => ({}));
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

    await db.collection('broadcastTokens').doc(token).delete();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
