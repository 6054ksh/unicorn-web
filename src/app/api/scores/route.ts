// src/app/api/scores/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { COL, ScoreDoc } from '@/types/firestore';

type Row = {
  uid: string;
  name: string;
  profileImage?: string;
  tempTitles?: string[];
  total: number;
  createdRooms?: number;
  joinedRooms?: number;
  lastUpdatedAt?: string;
  thumbsCount?: number;
  heartsCount?: number;
};

export async function GET(req: Request) {
  try {
    const db = getAdminDb();
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 50), 200));

    // scores 수집 → uid -> ScoreDoc
    const scoreSnap = await db.collection(COL.scores).get();
    const scoreMap = new Map<string, ScoreDoc>();
    scoreSnap.forEach(d => {
      scoreMap.set(d.id, d.data() as ScoreDoc);
    });

    // users 메타 + 점수 머지
    const usersSnap = await db.collection(COL.users).get();
    const users: Row[] = [];
    usersSnap.forEach(d => {
      const v = d.data() as any;
      const s: ScoreDoc | undefined = scoreMap.get(d.id);

      users.push({
        uid: d.id,
        name: v?.name || '(이름없음)',
        profileImage: v?.profileImage || '',
        tempTitles: Array.isArray(v?.tempTitles) ? v.tempTitles : [],
        total: s?.total ?? 0,
        createdRooms: s?.createdRooms ?? 0,
        joinedRooms: s?.joinedRooms ?? 0,
        lastUpdatedAt: s?.lastUpdatedAt ?? '',
        // 아래 두 값은 roomVotes 전수 집계로 다시 덮어씁니다. (없으면 0)
        thumbsCount: s?.thumbsCount ?? 0,
        heartsCount: s?.heartsCount ?? 0,
      });
    });

    // roomVotes 전수 집계로 👍/❤️ 계산
    const votesSnap = await db.collection(COL.roomVotes).get();
    const thumbs = new Map<string, number>(); // uid -> count
    const hearts = new Map<string, number>(); // uid -> count

    votesSnap.forEach(d => {
      const v = d.data() as any;
      if (v?.thumbsForUid) thumbs.set(v.thumbsForUid, (thumbs.get(v.thumbsForUid) || 0) + 1);
      if (v?.heartForUid) hearts.set(v.heartForUid, (hearts.get(v.heartForUid) || 0) + 1);
    });

    users.forEach(u => {
      u.thumbsCount = thumbs.get(u.uid) ?? u.thumbsCount ?? 0;
      u.heartsCount = hearts.get(u.uid) ?? u.heartsCount ?? 0;
    });

    users.sort((a, b) => b.total - a.total);

    return NextResponse.json({ users: users.slice(0, limit) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
