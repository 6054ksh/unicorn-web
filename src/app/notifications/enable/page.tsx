'use client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React, { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

// 이 페이지는 브라우저 전용 API(Notification, matchMedia 등)를 쓰므로
// 어떤 브라우저 전용 코드도 "모듈 최상단"에서 실행되면 안 됩니다.

export default function EnableNotificationsPage() {
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let mounted = true;

    async function run() {
      // 🔒 SSR/빌드 시 안전 가드
      if (typeof window === 'undefined') return;

      // 권한 요청
      if (!('Notification' in window)) {
        setMsg('이 브라우저는 푸시 알림(웹 푸시)을 지원하지 않습니다.');
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

      // ⬇️ 브라우저 전용 FCM 유틸은 동적 import로 클라이언트에서만 로드
      const { requestAndGetFcmToken, listenForeground } = await import('@/lib/firebaseMessaging');

      // FCM 토큰 발급
      const t = await requestAndGetFcmToken();
      if (!mounted) return;
      setToken(t);

      if (!t) {
        setStatus('error');
        setMsg('FCM 토큰 발급 실패');
        return;
      }

      // 서버에 토큰 등록
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
      } catch (e) {
        setStatus('error');
        setMsg('토큰 등록 중 오류가 발생했습니다.');
      }

      // 포그라운드 수신 로그(선택)
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
          <li>iOS Safari는 iOS 16.4 이상에서만 웹 푸시를 지원하며, <b>홈 화면에 추가(PWA)</b>해야 푸시를 받을 수 있습니다.</li>
          <li>브라우저의 알림 권한이 “차단”이면, 브라우저 설정에서 사이트 알림 권한을 “허용”으로 바꿔주세요.</li>
          <li>로그인 상태가 바뀌면 알림 토큰을 다시 등록해 주세요.</li>
        </ul>
      </details>
    </main>
  );
}
