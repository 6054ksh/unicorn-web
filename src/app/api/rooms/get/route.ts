// src/app/api/rooms/get/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate();
  try { return new Date(v); } catch { return null; }
}

export async function GET(req: Request) {
  try {
    const db = getAdminDb();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const withParticipants = url.searchParams.get('withParticipants') === '1';

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const snap = await db.collection('rooms').doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: 'not-found' }, { status: 404 });

    const data = snap.data() as any;

    const startAt = toDate(data.startAt);
    const _revealAt = toDate(data.revealAt) || (startAt ? new Date(startAt.getTime() - 60 * 60 * 1000) : null);
    const now = new Date();
    const anonymize = _revealAt ? now < _revealAt : true;

    let participantsInfo: Array<{ uid: string; name: string; profileImage?: string }> | undefined;

    if (withParticipants) {
      const uids: string[] = Array.isArray(data?.participants) ? data.participants : [];
      participantsInfo = [];
      // Firestore 'in' 쿼리는 최대 10개씩
      for (let i = 0; i < uids.length; i += 10) {
        const group = uids.slice(i, i + 10);
        if (!group.length) continue;
        const q = db.collection('users').where('__name__', 'in', group);
        const usr = await q.get();
        usr.forEach((d) => {
          const u = d.data() as any;
          participantsInfo!.push({
            uid: d.id,
            name: anonymize ? '익명' : (u?.name || '익명'),
            profileImage: anonymize ? '' : (u?.profileImage || ''),
          });
        });
      }
      // uids 순서로 정렬(옵션)
      participantsInfo.sort((a, b) => uids.indexOf(a.uid) - uids.indexOf(b.uid));
    }

    return NextResponse.json({
      ok: true,
      room: {
        id: snap.id,
        ...data,
        startAt: startAt?.toISOString() ?? null,
        endAt: toDate(data.endAt)?.toISOString() ?? null,
        revealAt: _revealAt?.toISOString() ?? null,
        participantsCount: Array.isArray(data?.participants) ? data.participants.length : (data.participantsCount ?? 0),
        ...(withParticipants ? { participantsInfo } : {}),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
