// src/app/api/rooms/participants/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { FieldPath } from 'firebase-admin/firestore';

export async function GET(req: Request) {
  try {
    const db = getAdminDb();
    const url = new URL(req.url);
    const roomId = url.searchParams.get('roomId');
    if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 });

    const snap = await db.collection('rooms').doc(roomId).get();
    if (!snap.exists) return NextResponse.json({ error: 'not-found' }, { status: 404 });

    const data = snap.data() as any;
    const startAt = data?.startAt ? new Date(data.startAt) : null;
    const explicitReveal = data?.revealAt ? new Date(data.revealAt) : null;

    if (!startAt || Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: 'invalid-startAt' }, { status: 400 });
    }

    const revealAt = explicitReveal || new Date(startAt.getTime() - 60 * 60 * 1000);
    const now = new Date();

    if (now < revealAt) {
      return NextResponse.json(
        { ok: false, notRevealed: true, revealAt: revealAt.toISOString() },
        { status: 403 }
      );
    }

    const ids: string[] = Array.isArray(data?.participants) ? data.participants.slice(0, 200) : [];
    if (!ids.length) {
      return NextResponse.json({ ok: true, revealAt: revealAt.toISOString(), participants: [], count: 0 });
    }

    const participants: { uid: string; name: string; profileImage?: string }[] = [];
    for (let i = 0; i < ids.length; i += 10) {
      const group = ids.slice(i, i + 10);
      const users = await db.collection('users').where(FieldPath.documentId(), 'in', group).get();
      users.forEach((d) => {
        const u = d.data() as any;
        participants.push({
          uid: d.id,
          name: u?.name || '이름없음',
          profileImage: u?.profileImage || '',
        });
      });
    }

    // 문서 없는 uid도 fallback으로 채워줌
    ids.forEach((uid) => {
      if (!participants.find((p) => p.uid === uid)) participants.push({ uid, name: uid });
    });

    return NextResponse.json({
      ok: true,
      revealAt: revealAt.toISOString(),
      count: participants.length,
      participants,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
