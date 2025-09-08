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

    const nowIso = new Date().toISOString();

    const markBatch = async (col: FirebaseFirestore.CollectionReference) => {
      let total = 0;
      for (let i = 0; i < 10; i++) {
        const snap = await col.where('unread', '==', true).limit(500).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach(d => batch.update(d.ref, { unread: false, readAt: nowIso }));
        await batch.commit();
        total += snap.size;
        if (snap.size < 500) break;
      }
      return total;
    };

    // 구 경로(users/{uid}/notifications)
    const legacyCol = db.collection('users').doc(uid).collection('notifications');
    // 신 경로(notifications/{uid}/items)
    const newCol = db.collection('notifications').doc(uid).collection('items');

    const [a, b] = await Promise.all([markBatch(legacyCol), markBatch(newCol)]);

    return NextResponse.json({ ok: true, updated: a + b });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
