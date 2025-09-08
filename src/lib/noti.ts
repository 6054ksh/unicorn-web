// src/lib/noti.ts
import admin from 'firebase-admin';
import { getAdminDb, getAdminMessaging } from '@/lib/firebaseAdmin';

export async function fetchTokensForUsers(uids: string[]) {
  const db = getAdminDb();
  const unique = Array.from(new Set(uids)).filter(Boolean);
  const owners = new Map<string, string[]>(); // token -> [uid...]
  const tokens: string[] = [];

  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await db
      .collection('users')
      // Firestore 문서ID in 쿼리
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();

    snap.forEach((d) => {
      const arr: string[] = Array.isArray((d.data() as any)?.fcmTokens)
        ? ((d.data() as any).fcmTokens as string[])
        : [];
      for (const t of arr) {
        if (!t) continue;
        if (!owners.has(t)) owners.set(t, []);
        owners.get(t)!.push(d.id);
        if (!tokens.includes(t)) tokens.push(t);
      }
    });
  }

  return { tokens, owners };
}

export async function removeBadTokens(badTokens: string[], owners: Map<string, string[]>) {
  if (!badTokens.length) return;
  const db = getAdminDb();
  const batch = db.batch();
  for (const t of badTokens) {
    const uids = owners.get(t) || [];
    for (const uid of uids) {
      batch.update(db.collection('users').doc(uid), {
        fcmTokens: admin.firestore.FieldValue.arrayRemove(t),
      });
    }
  }
  await batch.commit().catch(() => {});
}

export async function addUserNotifications(
  uids: string[],
  payload: { type: string; title: string; body?: string; url?: string; createdAt?: string }
) {
  const db = getAdminDb();
  const now = payload.createdAt || new Date().toISOString();
  const batch = db.batch();
  for (const uid of uids) {
    if (!uid) continue;
    const ref = db.collection('notifications').doc(uid).collection('items').doc();
    batch.set(ref, {
      id: ref.id,
      scope: 'user',
      unread: true,
      createdAt: now,
      ...payload,
    });
  }
  await batch.commit();
}

export async function pushMulticast(tokens: string[], msg: { title: string; body?: string; url?: string; tag?: string }) {
  if (!tokens.length) return { success: 0, failure: 0, badTokens: [] as string[] };
  const messaging = getAdminMessaging();

  const badTokens: string[] = [];
  let success = 0;
  let failure = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      tokens: chunk,
      webpush: {
        headers: { Urgency: 'high', TTL: '120' },
        fcmOptions: msg.url ? { link: msg.url } : undefined,
        notification: { title: msg.title, body: msg.body || '', tag: msg.tag || undefined, renotify: true },
      },
      data: msg.url ? { url: msg.url } : undefined,
    });
    res.responses.forEach((r, idx) => {
      if (r.success) success += 1;
      else {
        failure += 1;
        const code = (r.error as any)?.code || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
          badTokens.push(chunk[idx]);
        }
      }
    });
  }
  return { success, failure, badTokens };
}
