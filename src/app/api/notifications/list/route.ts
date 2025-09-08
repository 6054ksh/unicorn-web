export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

function toIso(v: any): string | undefined {
  if (!v) return undefined;
  // Firestore Timestamp 지원
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

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    // 사용자 알림: notifications/{uid}/items
    const uref = db.collection('notifications').doc(uid).collection('items').orderBy('createdAt', 'desc').limit(limit);
    const usnap = await uref.get();
    const userItems = usnap.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        scope: 'user',
        ...data,
        createdAt: toIso(data?.createdAt),
      };
    });

    const unreadCount = userItems.filter((x) => x.unread === true).length;

    // 글로벌 알림 1: notifications_global (기존 호환)
    const g1snap = await db.collection('notifications_global').orderBy('createdAt', 'desc').limit(10).get().catch(() => null);
    const g1 = g1snap?.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        scope: 'global',
        ...data,
        createdAt: toIso(data?.createdAt),
      };
    }) || [];

    // 글로벌 알림 2: notifications/global/items (현재 권장)
    const g2snap = await db.collection('notifications').doc('global').collection('items').orderBy('createdAt', 'desc').limit(10).get().catch(() => null);
    const g2 = g2snap?.docs.map(d => {
      const data = d.data() as any;
      return {
        id: d.id,
        scope: 'global',
        ...data,
        createdAt: toIso(data?.createdAt),
      };
    }) || [];

    return NextResponse.json({ ok: true, unreadCount, notifications: [...userItems, ...g1, ...g2] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
