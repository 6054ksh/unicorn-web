'use client';

import { useEffect, useState } from 'react';
import { requestAndGetFcmToken, listenForeground } from '@/lib/firebaseMessaging';
import { authedFetch } from '@/lib/authedFetch';

export default function EnableNotificationsPage() {
  const [status, setStatus] = useState<'idle'|'granted'|'denied'|'error'>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  const registerToken = async () => {
    try {
      if (!('Notification' in window)) { setMsg('브라우저가 알림을 지원하지 않아요.'); return; }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus(perm as any); setMsg('알림 권한이 허용되지 않았습니다.'); return; }
      setStatus('granted');

      const t = await requestAndGetFcmToken();
      setToken(t);
      if (!t) { setStatus('error'); setMsg('FCM 토큰 발급 실패'); return; }

      const res = await authedFetch('/api/me/register-fcm-token', { method: 'POST', body: JSON.stringify({ token: t }) });
      if (!res.ok) { setStatus('error'); setMsg('토큰 등록 실패: ' + (await res.text())); return; }
      setMsg('알림 설정 완료 (rooms_all 토픽 구독)');
    } catch (e: any) {
      setStatus('error'); setMsg(e?.message ?? String(e));
    }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const res = await authedFetch('/api/notifications/test-send', {
        method: 'POST',
        body: JSON.stringify({ title: '테스트 ✨', body: '푸시 동작 확인', url: '/' })
      });
      const j = await res.json();
      setMsg(res.ok ? `테스트 발송 완료 (성공 ${j.successCount}, 실패 ${j.failureCount})` : `실패: ${j.error}`);
    } catch (e: any) {
      setMsg('실패: ' + (e?.message ?? String(e)));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    listenForeground((payload) => {
      console.log('🔔 onMessage:', payload);
    });
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>알림 설정</h1>
      <p style={{ color:'#666' }}>
        • 알림은 <b>“방 생성 시”</b> 1회 공지로만 전송됩니다. (스팸 X)<br/>
        • Android는 브라우저 푸시가 비교적 즉시 도착합니다.<br/>
        • iOS는 <b>홈 화면에 추가(PWA)</b> 시 가장 안정적으로 수신됩니다.
      </p>

      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button onClick={registerToken}>알림 권한 요청 & 토큰 등록</button>
        <button onClick={sendTest} disabled={sending}>테스트 푸시 보내기</button>
      </div>

      <p style={{ marginTop:10 }}>상태: {status}</p>
      {token ? <p style={{ wordBreak:'break-all' }}>토큰: {token}</p> : null}
      <p>{msg}</p>
    </main>
  );
}
