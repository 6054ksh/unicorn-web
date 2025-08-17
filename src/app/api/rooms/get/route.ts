import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const db = getAdminDb();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const snap = await db.collection('rooms').doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }

    const data = snap.data() as any;
    return NextResponse.json({ ok: true, room: { id: snap.id, ...data } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
