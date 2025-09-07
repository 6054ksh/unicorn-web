import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await adminAuth.verifyIdToken(idToken);

    let body: any = {};
    try { body = await req.json(); } catch {}
    const notifId: string | undefined = body?.notifId;
    const action: 'delete' | 'read' = body?.action === 'read' ? 'read' : 'delete';
    if (!notifId) return NextResponse.json({ error: 'notifId required' }, { status: 400 });

    const ref = adminDb.collection('users').doc(uid).collection('notifications').doc(notifId);

    if (action === 'read') {
      await ref.set({ unread: false, updatedAt: new Date().toISOString() }, { merge: true });
    } else {
      await ref.delete();
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
