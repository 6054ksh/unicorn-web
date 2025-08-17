import { isSupported, getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { firebaseApp } from '@/lib/firebase';

export async function getMessagingIfSupported(): Promise<Messaging | null> {
  try {
    const ok = await isSupported();
    if (!ok) return null;
    return getMessaging(firebaseApp);
  } catch {
    return null;
  }
}

export async function requestAndGetFcmToken(): Promise<string | null> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;
  try {
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });
    return token || null;
  } catch (e) {
    console.warn('getToken error', e);
    return null;
  }
}

export async function subscribeOnMessage(cb: (p: any) => void) {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return;
  onMessage(messaging, cb);
}
