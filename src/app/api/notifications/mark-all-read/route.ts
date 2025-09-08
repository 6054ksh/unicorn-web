// src/app/api/notifications/mark-all-read/route.ts
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

    const s1 = await db.collection('notifications').doc(uid).collection('items').where('unread','==',true).limit(500).get();
    const s2 = await db.collection('users').doc(uid).collection('notifications').where('unread','==',true).limit(500).get();

    const batch = db.batch();
    s1.docs.forEach(d => batch.update(d.ref, { unread: false }));
    s2.docs.forEach(d => batch.update(d.ref, { unread: false }));
    await batch.commit();

    return NextResponse.json({ ok: true, updated: s1.size + s2.size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
