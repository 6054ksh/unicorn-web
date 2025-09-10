export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
    const onlyUnread = searchParams.get('onlyUnread') === '1';

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const aSnap = await db.collection('notifications').doc(uid).collection('items').orderBy('createdAt', 'desc').limit(limit).get();
    const bSnap = await db.collection('users').doc(uid).collection('notifications').orderBy('createdAt', 'desc').limit(limit).get();

    const a = aSnap.docs.map(d => ({ id: d.id, scope:'user', ...(d.data() as any) }));
    const b = bSnap.docs.map(d => ({ id: d.id, scope:'user', ...(d.data() as any) }));

    const map = new Map<string, any>();
    [...a, ...b].forEach(x => { if (!map.has(x.id)) map.set(x.id, x); });
    let items = Array.from(map.values());

    if (onlyUnread) items = items.filter(x => x.unread === true);

    items.sort((x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || '')));
    items = items.slice(0, limit);

    const unreadCount = items.filter((x) => x.unread === true).length;

    // onlyUnread일 땐 글로벌 공지(읽음 개념 없음) 제외
    if (!onlyUnread) {
      const gsnap = await db.collection('notifications_global').orderBy('createdAt', 'desc').limit(10).get();
      const globals = gsnap.docs.map(d => ({ id: d.id, scope:'global', unread:false, ...(d.data() as any) }));
      items = [...items, ...globals].slice(0, limit);
    }

    return NextResponse.json({ ok:true, unreadCount, notifications: items });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
