'use client';

import { useEffect, useState } from 'react';
import { firebaseApp } from '@/lib/firebase';
import { authedFetch } from '@/lib/authedFetch';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type MessagePayload,
} from 'firebase/messaging';

export default function FcmRegistrar() {
  const [status, setStatus] = useState<'idle' | 'denied' | 'granted' | 'error'>('idle');

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        // 브라우저/환경 지원 여부 확인
        const supported = await isSupported().catch(() => false);
        if (!supported) return;

        // 알림 권한 요청
        if (!('Notification' in window)) return;
        const perm = await Notification.requestPermission();
        if (!mounted) return;

        if (perm !== 'granted') {
          setStatus(perm === 'denied' ? 'denied' : 'idle');
          return;
        }
        setStatus('granted');

        // 서비스워커 등록
        if (!('serviceWorker' in navigator)) {
          setStatus('error');
          return;
        }
        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        // VAPID 키 (클라이언트에서 쓰려면 NEXT_PUBLIC_ 접두어가 꼭 필요)
        const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
        if (!vapidKey) {
          console.warn('NEXT_PUBLIC_FCM_VAPID_KEY가 설정되어 있지 않습니다.');
          setStatus('error');
          return;
        }

        // FCM 토큰 발급
        const messaging = getMessaging(firebaseApp);
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swReg,
        }).catch((err) => {
          console.warn('getToken error', err);
          return null;
        });

        if (!mounted) return;
        if (!token) {
          setStatus('error');
          return;
        }

        // 서버에 토큰 등록
        try {
          const res = await authedFetch('/api/me/register-fcm-token', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          if (!res.ok) {
            console.warn('register token failed', await res.text());
            setStatus('error');
          }
        } catch (e) {
          console.warn('register token error', e);
          setStatus('error');
        }

        // 포그라운드 메시지 구독(이전 subscribeOnMessage 대체)
        onMessage(messaging, (payload: MessagePayload) => {
          // 필요하면 토스트/벨 카운트 갱신 등 UI 처리
          console.log('🔔 onMessage:', payload);
        });
      } catch (err) {
        console.warn('FCM init failed', err);
        if (mounted) setStatus('error');
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  // UI 노출이 필요없다면 null 유지
  return null;
}
