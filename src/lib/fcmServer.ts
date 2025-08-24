import * as admin from 'firebase-admin';
import { getAdminDb } from '@/lib/firebaseAdmin';

type TokenCarrier = { uid: string; token: string };

export async function collectAllUserTokens(): Promise<{ list: TokenCarrier[]; byToken: Map<string, string[]> }> {
  const db = getAdminDb();
  const snap = await db.collection('users').get();
  const list: TokenCarrier[] = [];
  const byToken = new Map<string, string[]>();

  snap.forEach(d => {
    const v = d.data() as any;
    const tokens: string[] = Array.isArray(v?.fcmTokens) ? v.fcmTokens : [];
    tokens.forEach(t => {
      if (!t) return;
      list.push({ uid: d.id, token: t });
      const arr = byToken.get(t) || [];
      arr.push(d.id);
      byToken.set(t, arr);
    });
  });

  // 중복 토큰 제거
  const seen = new Set<string>();
  const dedup = list.filter(x => {
    if (seen.has(x.token)) return false;
    seen.add(x.token);
    return true;
  });

  return { list: dedup, byToken };
}

export async function removeBadTokens(badTokens: string[], byToken: Map<string, string[]>) {
  if (!badTokens.length) return;
  const db = getAdminDb();
  const batch = db.batch();

  for (const t of badTokens) {
    const uids = byToken.get(t) || [];
    for (const uid of uids) {
      const ref = db.collection('users').doc(uid);
      batch.update(ref, { fcmTokens: admin.firestore.FieldValue.arrayRemove(t) });
    }
  }
  await batch.commit();
}
