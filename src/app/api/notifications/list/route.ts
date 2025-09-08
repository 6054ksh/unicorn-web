export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

function toIso(v: any): string | undefined {
  if (!v) return undefined;
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
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)));
    const onlyUnread = searchParams.get('onlyUnread') === '1';

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    // 신규 컬렉션
    let q1 = db.collection('notifications').doc(uid).collection('items') as FirebaseFirestore.Query;
    if (onlyUnread) q1 = q1.where('unread', '==', true);
    q1 = q1.orderBy('createdAt', 'desc').limit(limit);
    const s1 = await q1.get();
    const a1 = s1.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, scope: 'user', ...data, createdAt: toIso(data?.createdAt) };
    });

    // 레거시 컬렉션
    let q2 = db.collection('users').doc(uid).collection('notifications') as FirebaseFirestore.Query;
    if (onlyUnread) q2 = q2.where('unread', '==', true);
    q2 = q2.orderBy('createdAt', 'desc').limit(limit);
    const s2 = await q2.get();
    const a2 = s2.docs.map(d => {
      const data = d.data() as any;
      return { id: d.id, scope: 'user', ...data, createdAt: toIso(data?.createdAt) };
    });

    // 병합 + createdAt desc 정렬 + 중복 제거
    const map = new Map<string, any>();
    [...a1, ...a2].forEach(x => { if (!map.has(x.id)) map.set(x.id, x); });
    const merged = Array.from(map.values()).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, limit);

    const unreadCountSnap = await db.collection('notifications').doc(uid).collection('items').where('unread', '==', true).get();
    const unreadCountLegacySnap = await db.collection('users').doc(uid).collection('notifications').where('unread', '==', true).get();
    const unreadCount = unreadCountSnap.size + unreadCountLegacySnap.size;

    return NextResponse.json({ ok: true, unreadCount, notifications: merged });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
