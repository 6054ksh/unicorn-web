export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const ref = db.collection('notifications').doc(uid).collection('items').where('unread', '==', true).limit(200);
    const snap = await ref.get();

    const batch = db.batch();
    const nowIso = new Date().toISOString();
    snap.forEach(d => batch.set(d.ref, { unread: false, updatedAt: nowIso }, { merge: true }));
    await batch.commit();

    return NextResponse.json({ ok: true, updated: snap.size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
