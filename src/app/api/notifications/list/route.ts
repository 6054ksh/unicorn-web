export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const uref = db
      .collection('users')
      .doc(uid)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(50);
    const usnap = await uref.get();
    const userItems = usnap.docs.map((d) => ({ id: d.id, scope: 'user', ...(d.data() as any) }));

    const unreadCount = userItems.filter((x) => x.unread === true).length;

    const gsnap = await db.collection('notifications_global').orderBy('createdAt', 'desc').limit(10).get();
    const globalItems = gsnap.docs.map((d) => ({ id: d.id, scope: 'global', ...(d.data() as any) }));

    return NextResponse.json({ ok: true, unreadCount, notifications: [...userItems, ...globalItems] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
