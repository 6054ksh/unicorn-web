// src/app/notifications/enable/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { requestAndGetFcmToken, listenForeground } from '@/lib/firebaseMessaging';
import { authedFetch } from '@/lib/authedFetch';

export default function EnableNotificationsPage() {
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!('Notification' in window)) {
        setMsg('이 브라우저는 알림을 지원하지 않습니다.');
        return;
      }
      const perm = await Notification.requestPermission();
      if (!mounted) return;

      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'idle');
        setMsg('알림 권한이 허용되지 않았습니다.');
        return;
      }
      setStatus('granted');

      const t = await requestAndGetFcmToken();
      if (!mounted) return;
      setToken(t);
      if (!t) {
        setStatus('error');
        setMsg('FCM 토큰 발급 실패');
        return;
      }

      try {
        const res = await authedFetch('/api/me/register-fcm-token', {
          method: 'POST',
          body: JSON.stringify({ token: t }),
        });
        if (!res.ok) {
          setStatus('error');
          setMsg('토큰 등록 실패: ' + (await res.text()));
        } else {
          setMsg('알림 설정 완료');
        }
      } catch (e: unknown) {
        setStatus('error');
        setMsg('토큰 등록 에러');
      }

      // 포그라운드 수신 로그
      listenForeground((payload) => {
        console.log('🔔 onMessage:', payload);
      });
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>알림 설정</h1>
      <p>상태: {status}</p>
      {token ? <p style={{ wordBreak: 'break-all' }}>토큰: {token}</p> : null}
      <p>{msg}</p>
    </main>
  );
}
