export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { COL } from '@/lib/collections';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw httpError('unauthorized', 401);

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const adminSnap = await db.collection(COL.admins).doc(uid).get();
    if (!adminSnap.exists || !adminSnap.data()?.isAdmin) throw httpError('forbidden:not-admin', 403);

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '');
    if (!id) throw httpError('id required', 400);

    await db.collection(COL.feedback).doc(id).delete();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.status ?? 500;
    return NextResponse.json({ error: e?.message ?? String(e) }, { status });
  }
}
