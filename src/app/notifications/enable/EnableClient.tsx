'use client';

import React, { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

export default function EnableClient() {
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let mounted = true;

    async function run() {
      // 브라우저 환경 가드
      if (typeof window === 'undefined') return;

      if (!('Notification' in window)) {
        setMsg('이 브라우저는 웹 푸시를 지원하지 않습니다.');
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

      // 🔸 브라우저 전용 FCM 유틸은 동적 import로 로드
      const { requestAndGetFcmToken, listenForeground } = await import('@/lib/firebaseMessaging');

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
      } catch {
        setStatus('error');
        setMsg('토큰 등록 중 오류가 발생했습니다.');
      }

      // 선택: 포그라운드 수신 로그
      listenForeground((payload) => {
        console.log('🔔 onMessage:', payload);
      });
    }

    run();
    return () => { mounted = false; };
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>알림 설정</h1>
      <p>상태: {status}</p>
      {token ? <p style={{ wordBreak: 'break-all' }}>토큰: {token}</p> : null}
      <p>{msg}</p>

      <details style={{ marginTop: 12 }}>
        <summary>도움말</summary>
        <ul style={{ marginTop: 8 }}>
          <li>iOS Safari는 iOS 16.4+에서만 웹 푸시를 지원하며, <b>홈 화면에 추가(PWA)</b>해야 푸시가 동작합니다.</li>
          <li>브라우저 설정에서 사이트 알림 권한이 “허용”인지 확인해 주세요.</li>
          <li>로그인/로그아웃 시점이 바뀌면 알림 토큰을 다시 등록해 주세요.</li>
        </ul>
      </details>
    </main>
  );
}
