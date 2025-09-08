export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUid = String(searchParams.get('uid') || '').trim();
    if (!targetUid) return NextResponse.json({ error: 'uid required' }, { status: 400 });

    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await auth.verifyIdToken(idToken);

    const snap = await db.collection('users').doc(targetUid).get();
    if (!snap.exists) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    const d = snap.data() as any;
    return NextResponse.json({ ok: true, uid: targetUid, name: d?.name ?? null, profileImage: d?.profileImage ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
