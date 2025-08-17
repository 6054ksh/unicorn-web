import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

// 공개 목록: 기본 status=open (종료 숨김)
// ?status=open|closed|all, ?limit=50
export async function GET(req: Request) {
  try {
    const adminDb = getAdminDb();
    const url = new URL(req.url);
    const status = (url.searchParams.get('status') || 'open').toLowerCase();
    const limitNum = Number(url.searchParams.get('limit') || 50);

    let q: FirebaseFirestore.Query = adminDb.collection('rooms');

    if (status === 'open') {
      q = q.where('closed', '==', false);
    } else if (status === 'closed') {
      q = q.where('closed', '==', true);
    } // all이면 필터 없음

    // 최신순 정렬
    q = q.orderBy('startAt', 'desc').limit(Math.max(1, Math.min(limitNum, 200)));

    const snap = await q.get();
    const rooms = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return NextResponse.json({ ok: true, status, count: rooms.length, rooms });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const statusCode = msg === 'admin-not-initialized' ? 500 : 500;
    return NextResponse.json({ error: msg }, { status: statusCode });
  }
}
