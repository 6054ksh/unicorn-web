// src/app/notifications/enable/page.tsx
'use client';

import { useState } from 'react';
import { requestAndGetFcmToken, listenForeground } from '@/lib/firebaseMessaging';
import { authedFetch } from '@/lib/authedFetch';

export default function EnableNotificationsPage() {
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const run = async () => {
    setMsg('');
    if (!('Notification' in window)) {
      setMsg('이 브라우저는 알림을 지원하지 않습니다.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      setStatus(perm === 'denied' ? 'denied' : 'idle');
      setMsg('알림 권한이 허용되지 않았습니다.');
      return;
    }
    setStatus('granted');

    const t = await requestAndGetFcmToken();
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

    listenForeground((payload) => {
      console.log('🔔 onMessage:', payload);
    });
  };

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1>알림 설정</h1>
      <p style={{ color:'#666' }}>푸시 알림을 받으려면 브라우저 권한을 허용하고 FCM 토큰을 등록해야 합니다.</p>
      <button onClick={run} style={btnPrimary}>알림 권한 허용 + 토큰 등록</button>
      <p style={{ marginTop: 12 }}>상태: <b>{status}</b></p>
      {token ? <p style={{ wordBreak: 'break-all', fontSize:12, color:'#555' }}>토큰: {token}</p> : null}
      {msg && <p style={{ marginTop: 8, color: msg.startsWith('알림 설정 완료') ? '#14532d' : '#7f1d1d' }}>{msg}</p>}

      <hr style={{ margin:'16px 0' }} />
      <p>
        테스트 알림 보내보기: <a href="/notifications/test">/notifications/test</a>
      </p>
    </main>
  );
}

const btnPrimary: React.CSSProperties = { padding:'10px 14px', borderRadius:10, border:'1px solid #111', background:'#111', color:'#fff', cursor:'pointer' };
