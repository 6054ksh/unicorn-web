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

    const q = db
      .collection('users')
      .doc(uid)
      .collection('notifications')
      .where('unread', '==', true)
      .limit(100);
    const snap = await q.get();
    if (snap.empty) return NextResponse.json({ ok: true, updated: 0 });

    const batch = db.batch();
    const now = new Date().toISOString();
    snap.forEach((doc) => batch.update(doc.ref, { unread: false, updatedAt: now }));
    await batch.commit();

    return NextResponse.json({ ok: true, updated: snap.size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
