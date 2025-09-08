import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const url = new URL(req.url);
    const roomId = String(url.searchParams.get('roomId') || '').trim();
    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { uid } = await auth.verifyIdToken(idToken);

    const voteRef = db.collection('rooms').doc(roomId).collection('votes').doc(uid);
    const snap = await voteRef.get();
    return NextResponse.json({ ok: true, voted: snap.exists });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
