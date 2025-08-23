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
  startAt: string | Date;
  endAt: string | Date;
  closed?: boolean;
  participants?: string[];
  participantsCount?: number;
  type?: string;
  content?: string;
  revealAt?: string | Date;
};

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  try { return new Date(v); } catch { return null; }
}

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
      // 인덱스 요구 시 폴백
      if (msg.includes('requires an index')) {
        const all = await adminDb.collection('rooms').get();
        let roomsRaw = all.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Room[];
        if (status === 'open') roomsRaw = roomsRaw.filter((r) => !r.closed);
        if (status === 'closed') roomsRaw = roomsRaw.filter((r) => !!r.closed);
        roomsRaw.sort((a, b) => (new Date(b.startAt as any).getTime() - new Date(a.startAt as any).getTime()));
        roomsRaw = roomsRaw.slice(0, limitNum);

        const rooms = normalize(roomsRaw);
        return NextResponse.json({ ok: true, status, count: rooms.length, rooms });
      }
      throw e;
    }

    const roomsRaw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Room[];
    const rooms = normalize(roomsRaw);
    return NextResponse.json({ ok: true, status, count: rooms.length, rooms });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}

function normalize(list: Room[]) {
  const now = new Date().getTime();
  return list.map((r) => {
    const start = toDate(r.startAt);
    const end = toDate(r.endAt);
    const reveal = toDate(r.revealAt) || (start ? new Date(start.getTime() - 60 * 60 * 1000) : null);

    const pc = typeof r.participantsCount === 'number'
      ? r.participantsCount
      : (Array.isArray(r.participants) ? r.participants.length : 0);

    let state: 'preparing' | 'ongoing' | 'ended' = 'preparing';
    if (end && now >= end.getTime()) state = 'ended';
    else if (start && now >= start.getTime() && (!end || now < end.getTime())) state = 'ongoing';

    return {
      ...r,
      startAt: start?.toISOString() ?? null,
      endAt: end?.toISOString() ?? null,
      revealAt: reveal?.toISOString() ?? null,
      participantsCount: pc,
      state,
    };
  });
}
