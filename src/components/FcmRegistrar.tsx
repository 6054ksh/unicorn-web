'use client';

import { useEffect, useState } from 'react';
import { requestAndGetFcmToken, subscribeOnMessage } from '@/lib/fcm';
import { authedFetch } from '@/lib/authedFetch';

export default function FcmRegistrar() {
  const [status, setStatus] = useState<'idle'|'denied'|'granted'|'error'>('idle');

  useEffect(() => {
    let mounted = true;

    async function run() {
      // 권한 요청
      if (!('Notification' in window)) return;
      const perm = await Notification.requestPermission();
      if (!mounted) return;
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'idle');
        return;
      }
      setStatus('granted');

      // 토큰 발급 + 서버 등록
      const token = await requestAndGetFcmToken();
      if (!mounted) return;
      if (!token) { setStatus('error'); return; }

      try {
        const res = await authedFetch('/api/me/register-fcm-token', {
          method: 'POST',
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

      // 포그라운드 메시지
      subscribeOnMessage((payload) => {
        // 포그라운드에서는 Notification 대신 UI toast로 처리해도 좋음
        console.log('🔔 onMessage:', payload);
      });
    }

    run();
    return () => { mounted = false; };
  }, []);

  return null; // UI 필요없으면 숨김. 디버깅 원하면 상태를 표시해도 됨.
}
