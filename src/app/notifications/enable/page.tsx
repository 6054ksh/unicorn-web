'use client';

import { useEffect, useMemo, useState } from 'react';
import { requestAndGetFcmToken, listenForeground } from '@/lib/firebaseMessaging';
import { authedFetch } from '@/lib/authedFetch';

function detectEnv() {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent || '');
  const isStandalone = (globalThis as any)?.navigator?.standalone === true || matchMedia?.('(display-mode: standalone)')?.matches;
  const hasNotification = typeof window !== 'undefined' && 'Notification' in window;
  const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const hasPush = typeof window !== 'undefined' && 'PushManager' in window;
  return { isIOS, isSafari, isStandalone, hasNotification, hasSW, hasPush };
}

export default function EnableNotificationsPage() {
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const env = useMemo(() => detectEnv(), []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!env.hasNotification || !env.hasSW || !env.hasPush) {
        setMsg('이 브라우저는 웹 푸시를 완전히 지원하지 않습니다.');
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
      } catch {
        setStatus('error');
        setMsg('토큰 등록 에러');
      }

      listenForeground((payload) => {
        console.log('🔔 onMessage:', payload);
      });
    }

    run();
    return () => { mounted = false; };
  }, [env.hasNotification, env.hasSW, env.hasPush]);

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>알림 설정</h1>
      <p>상태: {status}</p>
      {token ? <p style={{ wordBreak: 'break-all' }}>토큰: {token}</p> : null}
      <p>{msg}</p>

      {/* 환경별 가이드 */}
      {(!env.hasNotification || !env.hasSW || !env.hasPush) && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10 }}>
          <b>사용자 가이드</b>
          <ul style={{ margin: '8px 0 0 16px' }}>
            {env.isIOS && env.isSafari ? (
              <>
                <li>iPhone/iPad Safari에서는 <b>홈 화면에 추가</b>한 후 앱(웹앱)에서 알림을 허용해야 합니다.</li>
                <li>공유 버튼 → <b>홈 화면에 추가</b> → 홈 화면의 아이콘으로 실행 → 알림 허용</li>
              </>
            ) : (
              <>
                <li>이 브라우저는 웹 푸시 기능(서비스 워커/Push API)을 완전히 지원하지 않습니다.</li>
                <li>Chrome/Edge/Firefox(데스크톱/안드로이드)나 PWA 설치 환경에서 다시 시도해 주세요.</li>
              </>
            )}
          </ul>
        </div>
      )}
    </main>
  );
}
