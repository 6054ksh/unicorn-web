// src/app/api/cron/tick/route.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth, getAdminMessaging } from '@/lib/firebaseAdmin';

export { GET, POST } from '@/app/api/rooms/cron/sweep/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request) {
  // 간단한 토큰 인증(선택 권장)
  const authz = req.headers.get('authorization') || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return bad('unauthorized', 401);
  }

  const db = getAdminDb();
  const messaging = getAdminMessaging();

  const now = new Date();
  const nowIso = now.toISOString();

  // 1) 최소인원 미달: 시작 시간이 지났고, 아직 closed=false이고, participantsCount < minCapacity
  const underMin: any[] = [];
  {
    // 인덱스: startAt asc / where closed==false 필요
    const snap = await db
      .collection('rooms')
      .where('closed', '==', false)
      .where('startAt', '<=', nowIso)
      .get();

    for (const doc of snap.docs) {
      const r = doc.data() as any;
      const joined = Number(r.participantsCount || (Array.isArray(r.participants) ? r.participants.length : 0));
      const minCap = Number(r.minCapacity || 0);
      if (minCap > 0 && joined < minCap) {
        underMin.push({ id: doc.id, ...r });
      }
    }
  }

  // 2) 종료시간 지난 방: closed=false && endAt <= now
  const needCloseForVote: any[] = [];
  {
    const snap = await db
      .collection('rooms')
      .where('closed', '==', false)
      .where('endAt', '<=', nowIso)
      .get();

    needCloseForVote.push(...snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  }

  // 트랜잭션/배치로 상태 변경
  const batch = db.batch();

  // 알림 수신자(토큰) 수집용
  const collectRoomMemberTokens = async (room: any) => {
    const uids: string[] = Array.isArray(room.participants) ? room.participants : [];
    if (!uids.length) return { tokens: [], owners: new Map<string, string[]>() };

    const usersSnap = await db.collection('users').where('__name__', 'in', uids.slice(0, 10)).get();
    // in쿼리는 10개 제한 → 10개 초과면 나눠서
    let docs = [...usersSnap.docs];
    for (let i = 10; i < uids.length; i += 10) {
      const s = await db.collection('users').where('__name__', 'in', uids.slice(i, i + 10)).get();
      docs = docs.concat(s.docs);
    }

    const tokens: string[] = [];
    const owners = new Map<string, string[]>();
    docs.forEach(d => {
      const v = d.data() as any;
      const arr: string[] = Array.isArray(v?.fcmTokens) ? v.fcmTokens : [];
      arr.forEach(t => {
        if (!t) return;
        if (!owners.has(t)) owners.set(t, []);
        owners.get(t)!.push(d.id);
        if (!tokens.includes(t)) tokens.push(t);
      });
    });
    return { tokens, owners };
  };

  // 1-a) underMin → closed 처리 + 알림 문서 생성
  for (const r of underMin) {
    const ref = db.collection('rooms').doc(r.id);
    batch.update(ref, { closed: true, endAt: nowIso, underMinClosedAt: nowIso });

    // 알림 로그(각 참여자용, scope:user)
    const title = '아쉽게도 인원이 부족해서 모임이 종료되었어요 😭';
    const body = `『${r.title}』 — 최소 ${r.minCapacity}명 필요, 현재 ${r.participantsCount || 0}명`;
    const participants: string[] = Array.isArray(r.participants) ? r.participants : [];
    participants.forEach(uid => {
      const nref = db.collection('notifications').doc();
      batch.set(nref, {
        id: nref.id,
        uid,
        scope: 'user',
        type: 'under-min-closed',
        title, body,
        url: `/room/${r.id}`,
        unread: true,
        createdAt: nowIso,
      });
    });

    // 푸시 알림(Firebase Cloud Messaging)
    const { tokens, owners } = await collectRoomMemberTokens(r);
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      const res = await messaging.sendEachForMulticast({
        tokens: chunk,
        webpush: {
          headers: { Urgency: 'high' },
          fcmOptions: { link: `/room/${r.id}` },
          notification: {
            title: '모임이 최소인원 미달로 종료되었어요 🥺',
            body,
            tag: `under-min-${r.id}`,
            renotify: true,
          },
        },
        data: { url: `/room/${r.id}`, roomId: r.id, type: 'under-min-closed' },
      });

      // 실패 토큰 정리
      const bad: string[] = [];
      res.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = (r.error as any)?.code || '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
            bad.push(chunk[idx]);
          }
        }
      });
      if (bad.length) {
        const b = db.batch();
        bad.forEach(t => {
          (owners.get(t) || []).forEach(uid => {
            b.update(db.collection('users').doc(uid), { fcmTokens: (db as any).FieldValue?.arrayRemove ? (db as any).FieldValue.arrayRemove(t) : [] });
          });
        });
        await b.commit();
      }
    }
  }

  // 2-a) endAt 지난 방 → closed 처리 + “투표 요청” 알림 생성/푸시
  for (const r of needCloseForVote) {
    const ref = db.collection('rooms').doc(r.id);
    batch.update(ref, { closed: true, closedAt: nowIso });

    const title = '투표 시간이 되었어요! 🗳️';
    const body = `『${r.title}』 모임이 끝났어요. 따봉/하트/노쇼 투표를 남겨주세요!`;

    const participants: string[] = Array.isArray(r.participants) ? r.participants : [];
    participants.forEach(uid => {
      const nref = db.collection('notifications').doc();
      batch.set(nref, {
        id: nref.id,
        uid,
        scope: 'user',
        type: 'vote-reminder',
        title, body,
        url: `/room/${r.id}?vote=1`,
        unread: true,
        createdAt: nowIso,
      });
    });

    const { tokens, owners } = await collectRoomMemberTokens(r);
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      const res = await messaging.sendEachForMulticast({
        tokens: chunk,
        webpush: {
          headers: { Urgency: 'high' },
          fcmOptions: { link: `/room/${r.id}?vote=1` },
          notification: {
            title: '모임이 끝났어요! 투표 부탁드려요 🗳️',
            body,
            tag: `vote-${r.id}`,
            renotify: true,
          },
        },
        data: { url: `/room/${r.id}?vote=1`, roomId: r.id, type: 'vote-reminder' },
      });

      const bad: string[] = [];
      res.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = (r.error as any)?.code || '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
            bad.push(chunk[idx]);
          }
        }
      });
      if (bad.length) {
        const b = db.batch();
        bad.forEach(t => {
          (owners.get(t) || []).forEach(uid => {
            b.update(db.collection('users').doc(uid), { fcmTokens: (db as any).FieldValue?.arrayRemove ? (db as any).FieldValue.arrayRemove(t) : [] });
          });
        });
        await b.commit();
      }
    }
  }

  await batch.commit();

  return NextResponse.json({
    ok: true,
    closedUnderMin: underMin.map(r => r.id),
    closedForVote: needCloseForVote.map(r => r.id),
    now: nowIso,
  });
}
