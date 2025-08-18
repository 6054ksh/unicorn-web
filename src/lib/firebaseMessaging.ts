// src/lib/firebaseMessaging.ts
'use client';

import { firebaseApp } from './firebase';
import {
  getMessaging,
  isSupported,
  getToken,
  onMessage,
  type MessagePayload,
} from 'firebase/messaging';

/** 브라우저 권한 요청 + FCM 토큰 발급 */
export async function requestAndGetFcmToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  if (Notification?.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return null;
  }

  const messaging = getMessaging(firebaseApp);
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY; // 반드시 설정 권장
  const token = await getToken(messaging, { vapidKey: vapidKey ?? undefined });
  return token ?? null;
}

/** 포그라운드 메시지 수신 리스너 */
export async function listenForeground(handler: (payload: MessagePayload) => void) {
  if (typeof window === 'undefined') return;
  const supported = await isSupported().catch(() => false);
  if (!supported) return;

  const messaging = getMessaging(firebaseApp);
  onMessage(messaging, handler);
}
