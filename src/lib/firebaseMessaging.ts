// src/lib/firebaseMessaging.ts
import {
  isSupported,
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
  type MessagePayload,
} from 'firebase/messaging';
import { firebaseApp } from '@/lib/firebase';

/** 지원 브라우저면 Messaging 인스턴스 반환 */
export async function getMessagingIfSupported(): Promise<Messaging | null> {
  try {
    const ok = await isSupported();
    if (!ok) return null;
    return getMessaging(firebaseApp);
  } catch {
    return null;
  }
}

/** 권한 요청 → FCM 토큰 발급 */
export async function requestAndGetFcmToken(): Promise<string | null> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;

  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });
    return token || null;
  } catch (e: unknown) {
    console.warn('getToken error', e);
    return null;
  }
}

/** 포그라운드 수신 콜백 등록 */
export async function subscribeOnMessage(cb: (payload: MessagePayload) => void): Promise<void> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return;
  onMessage(messaging, cb);
}

/** 과거 코드 호환용 별칭 */
export const listenForeground = subscribeOnMessage;
