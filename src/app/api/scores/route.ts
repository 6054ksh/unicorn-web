// src/app/api/scores/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const db = getAdminDb();
    const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get('limit') ?? 50), 1), 200);

    const scoreSnap = await db.collection('scores').orderBy('total', 'desc').limit(limit).get();
    const usersCol = db.collection('users');

    const usersMap: Record<string, any> = {};
    const uids = scoreSnap.docs.map((d) => d.id);

    for (let i = 0; i < uids.length; i += 10) {
      const chunk = uids.slice(i, i + 10);
      if (!chunk.length) continue;
      const us = await usersCol.where('__name__', 'in', chunk).get();
      us.forEach((d) => { usersMap[d.id] = d.data(); });
    }

    const users = scoreSnap.docs.map((d) => {
      const s = d.data() as any;
      const u = usersMap[d.id] || {};
      return {
        uid: d.id,
        name: u.name || '(이름없음)',
        profileImage: u.profileImage || '',
        total: s.total || 0,
        createdRooms: s.createdRooms || 0,
        joinedRooms: s.joinedRooms || 0,
        lastUpdatedAt: s.lastUpdatedAt || '',
        tempTitles: Array.isArray(u.tempTitles) ? u.tempTitles : [],
      };
    });

    return NextResponse.json({ users, count: users.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
