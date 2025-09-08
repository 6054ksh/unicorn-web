// src/app/api/rooms/vote-status/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authz = req.headers.get('authorization') || '';
    const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : null;
    if (!idToken) return NextResponse.json({ error:'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const { searchParams } = new URL(req.url);
    const roomId = String(searchParams.get('roomId') || '').trim();
    if (!roomId) return NextResponse.json({ error:'roomId required' }, { status: 400 });

    const ref = db.collection('rooms').doc(roomId).collection('votes').doc(uid);
    const s = await ref.get();
    return NextResponse.json({ ok:true, voted: s.exists });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
