export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { COL } from '@/lib/collections';

export async function GET(req: Request) {
  try {
    const db = getAdminDb();
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 50), 200));

    // (선택) 로그인 유저가 누른 좋아요 표시를 위해 uid 추출
    let myUid: string | null = null;
    try {
      const authHeader = req.headers.get('authorization') || '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (idToken) {
        const { uid } = await getAdminAuth().verifyIdToken(idToken);
        myUid = uid;
      }
    } catch {/* ignore */}

    const snap = await db.collection(COL.feedback)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const items = snap.docs.map((d) => {
      const v = d.data() as any;
      const likedBy = Array.isArray(v?.likedBy) ? v.likedBy as string[] : [];
      return {
        id: d.id,
        uid: v.uid || '',
        name: v.name || '익명',
        profileImage: v.profileImage || '',
        text: v.text || '',
        createdAt: v.createdAt || '',
        likesCount: Number(v.likesCount || likedBy.length || 0),
        liked: myUid ? likedBy.includes(myUid) : false,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
