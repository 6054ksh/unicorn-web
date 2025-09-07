import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 기능:
 *  A) now >= startAt 이고 아직 closed=false이며, 참여인원 < minCapacity => 최소인원 미달 종료 + 알림(참여자 & 개설자)
 *  B) now >= endAt 이고 아직 closed=false => 정상 종료로 closed=true
 *  C) 종료(closed=true) 되었고 voteReminderSentAt 없음 && abortedUnderMin != true => 투표 알림 생성(참여자 전원)
 *
 *  리스트/집계에서는 abortedUnderMin=true 인 방은 "종료 목록"에 안 보이도록 UI에서 필터해주세요.
 */
export async function POST() {
  try {
    const db = getAdminDb();
    const now = new Date();
    const nowIso = now.toISOString();

    // --- A) 최소인원 미달 종료 ---
    {
      const snap = await db
        .collection('rooms')
        .where('closed', '==', false)
        .where('startAt', '<=', nowIso)
        .limit(400)
        .get();

      const rooms = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const targets = rooms.filter(r => {
        const minCap = Number(r?.minCapacity || 0);
        const count = Number(r?.participantsCount ?? (Array.isArray(r?.participants) ? r.participants.length : 0));
        return minCap > 0 && count < minCap; // 미달
      });

      for (const r of targets) {
        const batch = db.batch();
        const ref = db.collection('rooms').doc(r.id);
        batch.update(ref, {
          closed: true,
          abortedUnderMin: true,
          abortedAt: nowIso,
          endAt: nowIso, // 즉시 종료 처리
          updatedAt: nowIso,
        });

        // 알림 대상: 참가자 + 개설자(중복 제거)
        const participants: string[] = Array.isArray(r?.participants) ? r.participants : [];
        const targetsUids = new Set<string>(participants);
        if (r?.creatorUid) targetsUids.add(String(r.creatorUid));

        for (const u of targetsUids) {
          const nref = db.collection('users').doc(u).collection('notifications').doc();
          batch.set(nref, {
            type: 'under-min-abort',
            title: '아쉽지만… 모임이 취소되었어요 😢',
            body: `『${r.title || '모임'}』이(가) 최소 인원을 채우지 못해 취소되었어요.`,
            url: '/room', // 목록으로 유도
            unread: true,
            createdAt: nowIso,
            roomId: r.id,
          });
        }

        await batch.commit();
      }
    }

    // --- B) 종료시간 도달했는데 아직 closed=false => 종료 처리 ---
    {
      const snap = await db
        .collection('rooms')
        .where('closed', '==', false)
        .where('endAt', '<=', nowIso)
        .limit(400)
        .get();

      const targets = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      for (const r of targets) {
        await db.collection('rooms').doc(r.id).set(
          { closed: true, updatedAt: nowIso },
          { merge: true }
        );
      }
    }

    // --- C) 투표 리마인더: 종료되었고 아직 voteReminderSentAt 없음 && 최소인원 취소가 아닌 방 ---
    {
      const snap = await db
        .collection('rooms')
        .where('closed', '==', true)
        .limit(500)
        .get();

      const rooms = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const targets = rooms.filter(r => !r.voteReminderSentAt && !r.abortedUnderMin);

      for (const r of targets) {
        const participants: string[] = Array.isArray(r?.participants) ? r.participants : [];
        if (!participants.length) {
          await db.collection('rooms').doc(r.id).set({ voteReminderSentAt: nowIso }, { merge: true });
          continue;
        }

        const batch = db.batch();
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
        batch.set(db.collection('rooms').doc(r.id), { voteReminderSentAt: nowIso }, { merge: true });
        await batch.commit();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
