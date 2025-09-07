// src/lib/server/notify.ts
import { getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';

export type NotiPayload = {
  type: 'vote-reminder' | 'participant-joined' | 'under-min-closed' | 'room-created' | 'generic';
  title: string;
  body?: string;
  url?: string;
};

const nowIso = () => new Date().toISOString();

/** 개별 사용자 알림: Firestore(벨 패널용) + FCM */
export async function notifyUser(uid: string, payload: NotiPayload) {
  const db = getAdminDb();
  const messaging = getAdminMessaging();

  // 1) 벨 패널용 저장
  await db
    .collection('users')
    .doc(uid)
    .collection('notifications')
    .add({
      ...payload,
      unread: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

  // 2) FCM 멀티캐스트
  const usnap = await db.collection('users').doc(uid).get();
  const tokens: string[] = Array.isArray((usnap.data() as any)?.fcmTokens)
    ? (usnap.data() as any).fcmTokens
    : [];
  if (!tokens.length) return;

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    await messaging
      .sendEachForMulticast({
        tokens: chunk,
        webpush: {
          headers: { Urgency: 'high', TTL: '180' },
          fcmOptions: { link: payload.url || '/' },
          notification: {
            title: payload.title,
            body: payload.body || '',
            tag: payload.type,
            renotify: true,
          },
        },
        data: { url: payload.url || '/' },
      })
      .catch(() => {});
  }
}

/** 여러 사용자에게 병렬 발송 */
export async function notifyMany(uids: string[], payload: NotiPayload) {
  await Promise.all(uids.map((u) => notifyUser(u, payload).catch(() => {})));
}

/** 전체에게 보이는 글로벌 알림(벨 패널 목록용). FCM 브로드캐스트와 별개. */
export async function pushGlobal(payload: NotiPayload) {
  const db = getAdminDb();
  await db.collection('notifications_global').add({
    ...payload,
    createdAt: nowIso(),
  });
}
