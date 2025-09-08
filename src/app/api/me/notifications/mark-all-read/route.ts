// src/app/api/notifications/mark-all-read/route.ts
import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const nowIso = new Date().toISOString();

    const markPath = async (colRef: FirebaseFirestore.CollectionReference) => {
      let updated = 0;
      for (let i = 0; i < 10; i++) { // 10*500=5,000
        const snap = await colRef.where('unread', '==', true).limit(500).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach(d => batch.update(d.ref, { unread: false, readAt: nowIso }));
        await batch.commit();
        updated += snap.size;
        if (snap.size < 500) break;
      }
      return updated;
    };

    const a = db.collection('users').doc(uid).collection('notifications');        // 구경로
    const b = db.collection('notifications').doc(uid).collection('items');       // 신경로

    const updatedA = await markPath(a);
    const updatedB = await markPath(b);

    return NextResponse.json({ ok: true, updated: updatedA + updatedB });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
