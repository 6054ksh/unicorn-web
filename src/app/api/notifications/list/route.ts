// src/app/api/notifications/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

function toIso(v: any): string | undefined {
  try {
    if (!v) return undefined;
    if (typeof v === 'string') return v;
    if (v?.toDate) return v.toDate().toISOString(); // Firestore Timestamp
    if (v instanceof Date) return v.toISOString();
  } catch {}
  return undefined;
}

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 50)));

    // 구경로: users/{uid}/notifications
    const usnap = await db
      .collection('users').doc(uid).collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    const userItems = usnap.docs.map(d => {
      const v: any = d.data() || {};
      return ({
        id: v.id || d.id,
        scope: 'user',
        type: String(v.type || 'generic'),
        title: String(v.title || ''),
        body: v.body || '',
        url: v.url || '',
        createdAt: toIso(v.createdAt) || toIso(v.created_at) || undefined,
        unread: v.unread !== false,
        meta: v.meta || null,
      });
    });

    // 신경로: notifications/{uid}/items
    const nsnap = await db
      .collection('notifications').doc(uid).collection('items')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    const newItems = nsnap.docs.map(d => {
      const v: any = d.data() || {};
      return ({
        id: v.id || d.id,
        scope: 'user',
        type: String(v.type || 'generic'),
        title: String(v.title || ''),
        body: v.body || '',
        url: v.url || '',
        createdAt: toIso(v.createdAt) || toIso(v.created_at) || undefined,
        unread: v.unread !== false,
        meta: v.meta || null,
      });
    });

    // 글로벌
    const gsnap = await db.collection('notifications_global').orderBy('createdAt', 'desc').limit(10).get();
    const globalItems = gsnap.docs.map(d => {
      const v: any = d.data() || {};
      return ({
        id: v.id || d.id,
        scope: 'global',
        type: String(v.type || 'generic'),
        title: String(v.title || ''),
        body: v.body || '',
        url: v.url || '',
        createdAt: toIso(v.createdAt) || toIso(v.created_at) || undefined,
        unread: v.unread !== false, // 글로벌은 읽음 개념 없으면 false 취급해도 OK
        meta: v.meta || null,
      });
    });

    // 병합 + 정렬
    const merged = [...userItems, ...newItems, ...globalItems]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, limit);

    const unreadCount = [...userItems, ...newItems].filter(x => x.unread !== false).length;

    return NextResponse.json({ ok: true, unreadCount, notifications: merged });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
