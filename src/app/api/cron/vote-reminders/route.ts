// src/app/api/cron/vote-reminders/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore'; // ✅ 추가

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WINDOW_MS = 10 * 60 * 1000;

export async function GET() {
  try {
    const db = getAdminDb();
    const messaging = getAdminMessaging();

    const now = Date.now();
    const windowStart = new Date(now - WINDOW_MS).toISOString();

    const qs = await db
      .collection('rooms')
      .where('closed', '==', false)
      .where('endAt', '>=', windowStart)
      .get();

    const candidates = qs.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((r) => r.endAt <= new Date().toISOString() && r.voteOpen !== true);

    let sent = 0;

    for (const r of candidates) {
      const participants: string[] = Array.isArray(r.participants) ? r.participants : [];
      const batch = db.batch();

      batch.update(db.collection('rooms').doc(r.id), {
        voteOpen: true,
        voteDoneUids: Array.isArray(r.voteDoneUids) ? r.voteDoneUids : [],
        voteOpenedAt: new Date().toISOString(),
      });

      const tokenMap = new Map<string, string[]>(); // token -> [uid..]
      const tokens: string[] = [];

      for (const uid of participants) {
        const nref = db.collection('notifications').doc(uid).collection('items').doc();
        batch.set(nref, {
          type: 'vote',
          roomId: r.id,
          title: '투표 시작 💬',
          body: `『${r.title}』 투표를 해주세요! (종료 직후)`,
          url: `/room/${r.id}`,
          createdAt: new Date().toISOString(),
          read: false,
          pinned: true,
        });

        const us = await db.collection('users').doc(uid).get();
        const arr: string[] = Array.isArray(us.data()?.fcmTokens) ? us.data()!.fcmTokens : [];
        for (const t of arr) {
          if (!t) continue;
          if (!tokenMap.has(t)) tokenMap.set(t, []);
          tokenMap.get(t)!.push(uid);
          if (!tokens.includes(t)) tokens.push(t);
        }
      }

      await batch.commit();

      const base = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      const link = base ? `${base}/room/${r.id}` : `/room/${r.id}`;

      for (let i = 0; i < tokens.length; i += 500) {
        const chunk = tokens.slice(i, i + 500);
        const res = await messaging.sendEachForMulticast({
          tokens: chunk,
          webpush: {
            headers: { Urgency: 'high', TTL: '120' },
            fcmOptions: { link },
            notification: {
              title: '투표 시작 💬',
              body: `『${r.title}』 방 투표를 진행해주세요.`,
              tag: `vote-${r.id}`,
              renotify: true,
            },
          },
          data: { url: link, roomId: r.id, kind: 'vote' },
        });

        // ❌ 잘못된 토큰 정리 (여기가 핵심 수정)
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
          const batch2 = db.batch();
          for (const t of bad) {
            const owners = tokenMap.get(t) || [];
            for (const owner of owners) {
              batch2.update(db.collection('users').doc(owner), {
                fcmTokens: FieldValue.arrayRemove(t), // ✅ 올바른 사용법
              });
            }
          }
          await batch2.commit();
        }

        sent += res.successCount;
      }
    }

    return NextResponse.json({ ok: true, roomsProcessed: candidates.length, pushSent: sent });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
