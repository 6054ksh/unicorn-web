'use client';

import { firebaseApp } from '@/lib/firebase';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';

let _messaging: Messaging | null = null;

export async function getMessagingSafe() {
  const ok = await isSupported().catch(() => false);
  if (!ok) return null;
  if (_messaging) return _messaging;
  _messaging = getMessaging(firebaseApp);
  return _messaging;
}

export async function requestAndGetFcmToken(): Promise<string | null> {
  const messaging = await getMessagingSafe();
  if (!messaging) return null;

  // 알림 권한 요청
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return null;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;
  const token = await getToken(messaging, { vapidKey }).catch(() => null);
  return token ?? null;
}

export async function listenForeground(handler: (payload: any)=>void) {
  const messaging = await getMessagingSafe();
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
}
