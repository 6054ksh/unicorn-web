export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

type Noti = {
  id: string;
  scope?: 'user' | 'global';
  type?: string;
  title?: string;
  body?: string;
  url?: string;
  createdAt?: string;
  unread?: boolean;
  meta?: any;
};

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 50)));
    const onlyUnread = searchParams.get('onlyUnread') === '1';

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    // ── 유저 알림 (신/구 경로 병합) ─────────────────────────
    const userColLegacy = db.collection('users').doc(uid).collection('notifications');
    const userColNew = db.collection('notifications').doc(uid).collection('items');

    // 인덱스 상황 고려: orderBy 실패 시 정렬은 메모리에서
    const readCol = async (q: FirebaseFirestore.Query, tag: 'legacy' | 'new') => {
      try {
        const snap = await q.orderBy('createdAt', 'desc').limit(limit).get();
        return snap.docs.map(d => ({ id: d.id, scope: 'user', ...(d.data() as any) } as Noti));
      } catch {
        const snap = await q.limit(limit).get();
        return snap.docs.map(d => ({ id: d.id, scope: 'user', ...(d.data() as any) } as Noti));
      }
    };

    const [legacyItems, newItems] = await Promise.all([
      readCol(userColLegacy, 'legacy'),
      readCol(userColNew, 'new'),
    ]);

    // id가 다를 수 있으므로 createdAt 기준으로 합치되 중복(같은 payload) 최소화
    const mergedMap = new Map<string, Noti>();
    const pushAll = (arr: Noti[]) => {
      for (const n of arr) {
        const key = n.id || `${n.type}|${n.title}|${n.createdAt}`;
        if (!mergedMap.has(key)) mergedMap.set(key, n);
        else {
          // unread가 하나라도 true면 true로 유지
          const prev = mergedMap.get(key)!;
          mergedMap.set(key, { ...prev, ...n, unread: Boolean(prev.unread || n.unread) });
        }
      }
    };
    pushAll(legacyItems);
    pushAll(newItems);

    let userItems = Array.from(mergedMap.values());
    if (onlyUnread) userItems = userItems.filter(n => n.unread !== false);

    // 최신순 정렬
    userItems.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
    if (userItems.length > limit) userItems = userItems.slice(0, limit);

    const unreadCount = userItems.filter(n => n.unread !== false).length;

    // ── 글로벌 공지 (있으면 병행) ───────────────────────────
    let globalItems: Noti[] = [];
    try {
      const gsnap = await db.collection('notifications_global').orderBy('createdAt', 'desc').limit(10).get();
      globalItems = gsnap.docs.map(d => ({ id: d.id, scope: 'global', ...(d.data() as any) }));
    } catch {
      // 컬렉션 없으면 무시
    }

    return NextResponse.json({
      ok: true,
      unreadCount,
      notifications: [...userItems, ...globalItems],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
