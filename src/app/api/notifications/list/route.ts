export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

function toIso(v: any): string | undefined {
  if (!v) return undefined;
  // Timestamp 호환
  // @ts-ignore
  if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  if (typeof v === 'string') return v;
  return undefined;
}

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));
    const onlyUnread = searchParams.get('onlyUnread') === '1';

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    let q = db.collection('notifications').doc(uid).collection('items') as FirebaseFirestore.Query;
    if (onlyUnread) q = q.where('unread', '==', true);
    q = q.orderBy('createdAt', 'desc').limit(limit);

    const snap = await q.get();
    const items = snap.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, scope: 'user', ...data, createdAt: toIso(data?.createdAt) };
    });

    const unreadCount = (await db.collection('notifications').doc(uid).collection('items').where('unread', '==', true).get()).size;
    return NextResponse.json({ ok: true, unreadCount, notifications: items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
