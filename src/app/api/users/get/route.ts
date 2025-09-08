// src/app/api/users/get/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const auth = getAdminAuth();
    const db = getAdminDb();

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    await auth.verifyIdToken(idToken);

    const { searchParams } = new URL(req.url);
    const uid = String(searchParams.get('uid') || '').trim();
    if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });

    const s = await db.collection('users').doc(uid).get();
    if (!s.exists) return NextResponse.json({ ok: true, name: null, profileImage: null });
    const d = s.data() as any;
    return NextResponse.json({ ok: true, name: d?.name || null, profileImage: d?.profileImage || null });
  } catch (e:any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
