// src/lib/fcm.ts
'use client';

import { firebaseApp } from '@/lib/firebase';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

export async function requestAndGetFcmToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!(await isSupported())) return null;

  // 서비스워커 등록
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn('Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY');
    return null;
  }

  try {
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg,
    });
    return token || null;
  } catch (e) {
    console.error('getToken failed:', e);
    return null;
  }
}

export function subscribeOnMessage(cb: (payload: any) => void) {
  if (typeof window === 'undefined') return;
  isSupported().then((ok) => {
    if (!ok) return;
    const messaging = getMessaging(firebaseApp);
    onMessage(messaging, cb);
  });
}
