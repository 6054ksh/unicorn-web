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

    // A. 신 경로: notifications/{uid}/items
    const aSnap = await db
      .collection('notifications')
      .doc(uid)
      .collection('items')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const aItems = aSnap.docs.map((d) => {
      const v = d.data() as any;
      return {
        id: d.id,
        scope: 'user',
        ...v,
        unread: v?.unread === true, // undefined는 false 취급
      };
    });

    // B. 레거시 경로: users/{uid}/notifications
    const bSnap = await db
      .collection('users')
      .doc(uid)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const bItems = bSnap.docs.map((d) => {
      const v = d.data() as any;
      return {
        id: d.id,
        scope: 'user',
        ...v,
        unread: v?.unread === true,
      };
    });

    // 합치고 id로 중복 제거
    const map = new Map<string, any>();
    [...aItems, ...bItems].forEach((x) => {
      if (!map.has(x.id)) map.set(x.id, x);
    });
    let items = Array.from(map.values());

    // onlyUnread=1이면 unread === true만
    if (onlyUnread) items = items.filter((x) => x.unread === true);

    // 정렬 및 컷
    items.sort((x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || '')));
    items = items.slice(0, limit);

    const unreadCount = items.filter((x) => x.unread === true).length;

    // 글로벌 공지는 onlyUnread=1이면 제외 (읽음 상태 개념이 없어 계속 떠보이는 문제 방지)
    // 필요 시 onlyUnread=0 요청에서만 합치세요.
    const includeGlobal = !onlyUnread;
    if (includeGlobal) {
      const gsnap = await db.collection('notifications_global').orderBy('createdAt', 'desc').limit(10).get();
      const globalItems = gsnap.docs.map((d) => ({ id: d.id, scope: 'global', ...(d.data() as any), unread: false }));
      items = [...items, ...globalItems].slice(0, limit);
    }

    return NextResponse.json({ ok: true, unreadCount, notifications: items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
