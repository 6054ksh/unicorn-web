'use client';

import { useEffect, useState } from 'react';
import { requestAndGetFcmToken, listenForeground } from '@/lib/firebaseMessaging';
import { authedFetch } from '@/lib/authedFetch';

export default function EnableNotificationsPage() {
  const [msg, setMsg] = useState('');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // 포그라운드 알림 수신(선택)
    let unsub: any = null;
    (async () => {
      unsub = await listenForeground((payload) => {
        console.log('🔔 Foreground message:', payload);
      });
    })();
    return () => { try { unsub && unsub(); } catch {}
    };
  }, []);

  const onEnable = async () => {
    setMsg('권한 요청 및 토큰 발급 중…');
    try {
      const t = await requestAndGetFcmToken();
      if (!t) { setMsg('❌ 권한 거부되었거나 토큰 발급 실패'); return; }
      setToken(t);
      const res = await authedFetch('/api/me/register-fcm-token', {
        method: 'POST',
        body: JSON.stringify({ token: t }),
      });
      const j = await res.json();
      setMsg(res.ok ? '✅ 이 기기에서 알림 수신 준비 완료' : '❌ ' + (j.error || '등록 실패'));
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>알림 설정</h1>
      <p>버튼을 눌러 브라우저 푸시 알림을 허용하세요.</p>
      <button onClick={onEnable}>알림 권한 허용 및 등록</button>
      <p style={{ marginTop: 8 }}>{msg}</p>
      {token && (
        <details style={{ marginTop: 8 }}>
          <summary>내 FCM 토큰 보기</summary>
          <textarea readOnly value={token} style={{ width: '100%', height: 120 }} />
        </details>
      )}
    </main>
  );
}
