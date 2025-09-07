import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);

    const colRef = db.collection('users').doc(uid).collection('notifications');
    const snap = await colRef.get();

    const batch = db.batch();
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();

    return NextResponse.json({ ok: true, deleted: snap.size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
