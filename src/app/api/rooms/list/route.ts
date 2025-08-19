// src/app/api/rooms/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  startAt: string;
  endAt: string;
  closed?: boolean;
  participantsCount?: number;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = (url.searchParams.get('status') || 'open').toLowerCase();
    const limitNum = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 50), 200));

    let q = adminDb.collection('rooms') as FirebaseFirestore.Query;

    if (status === 'open') {
      q = q.where('closed', '==', false);
    } else if (status === 'closed') {
      q = q.where('closed', '==', true);
    }

    q = q.orderBy('startAt', 'desc').limit(limitNum);

    let snap: FirebaseFirestore.QuerySnapshot;

    try {
      snap = await q.get();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      // 인덱스 요구 시 폴백: 전체에서 필터/정렬
      if (msg.includes('requires an index')) {
        const all = await adminDb.collection('rooms').get();
        let rooms = all.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Room[];
        if (status === 'open') rooms = rooms.filter((r) => !r.closed);
        if (status === 'closed') rooms = rooms.filter((r) => !!r.closed);
        rooms.sort((a, b) => (new Date(b.startAt).getTime() - new Date(a.startAt).getTime()));
        rooms = rooms.slice(0, limitNum);
        return NextResponse.json({ ok: true, status, count: rooms.length, rooms });
      }
      throw e;
    }

    const rooms = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Room[];
    return NextResponse.json({ ok: true, status, count: rooms.length, rooms });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
