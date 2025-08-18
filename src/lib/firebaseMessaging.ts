// src/lib/firebaseMessaging.ts
// 클라이언트에서만 실행되게 가드
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  isSupported,
  getToken,
  onMessage,
  type Messaging,
  type MessagePayload,
} from 'firebase/messaging';

let app: FirebaseApp | null = null;
if (typeof window !== 'undefined') {
  const apps = getApps();
  app =
    apps[0] ??
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    });
}

let messagingPromise: Promise<Messaging | null> | null = null;
function ensureMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!messagingPromise) {
    messagingPromise = isSupported().then((ok) => (ok && app ? getMessaging(app) : null));
  }
  return messagingPromise;
}

// FCM 토큰 요청
export async function requestFcmToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const m = await ensureMessaging();
  if (!m) return null;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;
  try {
    const token = await getToken(m, { vapidKey });
    return token ?? null;
  } catch {
    return null;
  }
}

// 포그라운드 수신 리스너
export function listenForeground(cb: (payload: MessagePayload) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  let unsub = () => {};
  void ensureMessaging().then((m) => {
    if (m) {
      unsub = onMessage(m, cb);
    }
  });
  return () => unsub();
}
