import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const db = getAdminDb();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const ref = db.collection('rooms').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }

    const data = snap.data() as any;
    // 최소 정원 미달 정리
    const start = new Date(data.startAt);
    const end = data.endAt ? new Date(data.endAt) : new Date(start.getTime() + 5 * 60 * 60 * 1000);
    const now = new Date();
    const joined = Number(data.participantsCount ?? (Array.isArray(data.participants) ? data.participants.length : 0));
    const minCap = Number(data.minCapacity ?? 1);

    if (!data.closed && now >= start && joined < minCap) {
      await ref.delete().catch(() => {});
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, room: { id: snap.id, ...data } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
