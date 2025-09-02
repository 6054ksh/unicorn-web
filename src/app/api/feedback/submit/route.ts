// src/app/api/feedback/submit/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { COL, FeedbackDoc } from '@/types/firestore';

export async function POST(req: Request) {
  try {
    const db = getAdminDb();
    const auth = getAdminAuth();

    let uid: string | null = null;
    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (idToken) {
      try {
        const decoded = await auth.verifyIdToken(idToken);
        uid = decoded.uid;
      } catch { /* 익명도 허용 */ }
    }

    const body = await req.json().catch(() => ({}));
    const category = (body?.category || 'other') as FeedbackDoc['category'];
    const message = String(body?.message || '').trim();
    const contact = body?.contact ? String(body.contact).trim() : '';

    if (message.length < 5) {
      return NextResponse.json({ error: 'message too short' }, { status: 400 });
    }

    const doc: FeedbackDoc = {
      userUid: uid,
      category: ['bug','idea','other'].includes(category) ? category : 'other',
      message,
      contact,
      status: 'open',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      ua: req.headers.get('user-agent') || '',
      referer: req.headers.get('referer') || '',
    };

    const ref = await db.collection(COL.feedback).add(doc);
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
