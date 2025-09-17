// 예: src/lib/fcm.ts (클라이언트)
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const app = initializeApp({ /* same config as above */ });

export async function ensureFcmToken(): Promise<string | null> {
  if (!(await isSupported())) return null;

  const sw = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = getMessaging(app);

  // 브라우저 알림 권한 요청
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return null;
  }

  // VAPID 공개키 필수 (Firebase 콘솔 설정 > Web Push 인증서)
  const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY!;
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: sw });
  return token;
}

// 포그라운드 수신(앱 열려 있을 때)
export async function onForegroundNotification(cb: (payload: any) => void) {
  if (!(await isSupported())) return;
  const messaging = getMessaging(app);
  onMessage(messaging, cb);
}
