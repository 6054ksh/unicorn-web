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

    const colA = db.collection('notifications').doc(uid).collection('items');
    const colB = db.collection('users').doc(uid).collection('notifications');

    let deleted = 0;

    for (let i = 0; i < 20; i++) {
      const s = await colA.limit(500).get();
      if (s.empty) break;
      const b = db.batch();
      s.docs.forEach((d) => b.delete(d.ref));
      await b.commit();
      deleted += s.size;
      if (s.size < 500) break;
    }
    for (let i = 0; i < 20; i++) {
      const s = await colB.limit(500).get();
      if (s.empty) break;
      const b = db.batch();
      s.docs.forEach((d) => b.delete(d.ref));
      await b.commit();
      deleted += s.size;
      if (s.size < 500) break;
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
