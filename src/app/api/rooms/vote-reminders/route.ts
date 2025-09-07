import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

function httpError(message: string, status = 400) {
  const e: any = new Error(message);
  e.status = status;
  return e;
}

export async function POST(req: Request) {
  try {
    // (선택) 내부 호출만 허용하고 싶다면 Authorization 검사 추가 가능
    // const adminAuth = getAdminAuth(); ... 검증 로직

    const db = getAdminDb();
    const now = Date.now();

    // 최근 26시간 내에 종료됐고, voteReminderSentAt이 없고, 최소인원중단이 아닌 방
    const roomsSnap = await db.collection('rooms')
      .where('endAt', '<=', new Date(now).toISOString())
      .where('closed', '==', true)
      .limit(200)
      .get();

    const targets = roomsSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(r => !r.voteReminderSentAt && !r.abortedUnderMin);

    if (!targets.length) return NextResponse.json({ ok: true, sentFor: 0 });

    for (const r of targets) {
      const participants: string[] = Array.isArray(r?.participants) ? r.participants : [];
      if (!participants.length) {
        await db.collection('rooms').doc(r.id).set({ voteReminderSentAt: new Date().toISOString() }, { merge: true });
        continue;
      }

      const batch = db.batch();
      const nowIso = new Date().toISOString();

      for (const u of participants) {
        const nref = db.collection('users').doc(u).collection('notifications').doc();
        batch.set(nref, {
          type: 'vote-request',
          title: '투표하기 🗳️',
          body: `『${r.title || '모임'}』 투표가 열렸어요! 오늘 안에 한 번만 투표할 수 있어요.`,
          url: `/room/${r.id}`,
          unread: true,
          createdAt: nowIso,
          roomId: r.id,
        });
      }

      // 방에 마킹
      const rref = db.collection('rooms').doc(r.id);
      batch.set(rref, { voteReminderSentAt: nowIso }, { merge: true });

      await batch.commit();
    }

    return NextResponse.json({ ok: true, sentFor: targets.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: e?.status ?? 500 });
  }
}
