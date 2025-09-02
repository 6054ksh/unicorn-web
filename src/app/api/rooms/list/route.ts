export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  minCapacity: number;
  startAt: string;
  endAt?: string;
  closed?: boolean;
  participants?: string[];
  participantsCount?: number;
  type?: string;
  content?: string;
};

function calcEndAt(r: Room): Date {
  const start = new Date(r.startAt);
  if (r.endAt) {
    const e = new Date(r.endAt);
    if (!isNaN(e.getTime())) return e;
  }
  return new Date(start.getTime() + 5 * 60 * 60 * 1000);
}

function deriveState(r: Room): 'preparing' | 'ongoing' | 'ended' {
  const now = new Date();
  if (r.closed) return 'ended';
  const start = new Date(r.startAt);
  const end = calcEndAt(r);
  const joined = Number(r.participantsCount ?? (r.participants?.length ?? 0));
  if (now < start) return 'preparing';
  if (now >= start && now < end) {
    return joined >= (r.minCapacity ?? 1) ? 'ongoing' : 'preparing'; // min 미달이면 진행중으로 안 봄
  }
  return 'ended';
}

export async function GET(req: Request) {
  try {
    const db = getAdminDb();
    const url = new URL(req.url);
    const status = (url.searchParams.get('status') || 'all').toLowerCase(); // open/closed/all
    const limitNum = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 200));

    // ① 먼저 열린 방을 훑어 "시작시간 지났고 min 미달"이면 삭제
    {
      const openSnap = await db.collection('rooms')
        .where('closed', '==', false)
        .orderBy('startAt', 'desc')
        .limit(200)
        .get();

      const batch = db.batch();
      const now = new Date();

      openSnap.forEach(d => {
        const r = { id: d.id, ...(d.data() as any) } as Room;
        const start = new Date(r.startAt);
        const joined = Number(r.participantsCount ?? (r.participants?.length ?? 0));
        const minCap = Number(r.minCapacity ?? 1);
        if (now >= start && joined < minCap) {
          // 최소 정원 미달 → 방 삭제
          batch.delete(db.collection('rooms').doc(d.id));
        }
      });
      // 커밋(삭제할 게 있을 때만)
      if ((batch as any)['_ops']?.length) await batch.commit().catch(() => {});
    }

    // ② 목록 쿼리
    let q = db.collection('rooms') as FirebaseFirestore.Query;

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
      // 인덱스 오류 시 폴백: 전체 불러와서 필터/정렬
      if (msg.includes('requires an index')) {
        const all = await db.collection('rooms').get();
        let rooms = all.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Room[];
        if (status === 'open') rooms = rooms.filter(r => !r.closed);
        if (status === 'closed') rooms = rooms.filter(r => !!r.closed);
        rooms.sort((a, b) => +new Date(b.startAt) - +new Date(a.startAt));
        rooms = rooms.slice(0, limitNum);
        const withState = rooms.map(r => ({ ...r, state: deriveState(r) }));
        return NextResponse.json({ ok: true, status, count: withState.length, rooms: withState });
      }
      throw e;
    }

    const rooms = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Room[];
    const withState = rooms.map(r => ({ ...r, state: deriveState(r) }));
    return NextResponse.json({ ok: true, status, count: withState.length, rooms: withState });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
