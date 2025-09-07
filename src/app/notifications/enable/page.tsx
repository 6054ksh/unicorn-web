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
    (async () => {
      if (!('Notification' in window)) { setMsg('이 브라우저는 알림을 지원하지 않습니다.'); return; }
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
      if (!t) { setStatus('error'); setMsg('FCM 토큰 발급 실패'); return; }

      try {
        const res = await authedFetch('/api/me/register-fcm-token', { method:'POST', body: JSON.stringify({ token: t }) });
        if (!res.ok) { setStatus('error'); setMsg('토큰 등록 실패: ' + (await res.text())); }
        else { setMsg('알림 설정 완료'); }
      } catch {
        setStatus('error'); setMsg('토큰 등록 에러');
      }

      listenForeground((payload) => console.log('🔔 onMessage:', payload));
    })();
    return () => { mounted = false; };
  }, []);

  const sendTest = async () => {
    setMsg('테스트 발송 중…');
    try {
      const res = await authedFetch('/api/test/notify-me', { method:'POST', body: JSON.stringify({ title:'테스트 🔔', body:'바로 도착했나요?' }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'failed');
      setMsg(`테스트 발송 완료 (성공 ${j.success}, 실패 ${j.failure})`);
    } catch (e: any) {
      setMsg('전송실패: ' + (e?.message ?? String(e)));
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>알림 설정</h1>
      <p>상태: {status}</p>
      {token ? <p style={{ wordBreak: 'break-all' }}>토큰: {token}</p> : null}
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={sendTest} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #ddd' }}>테스트 알림 보내기</button>
      </div>
      <p style={{ marginTop:8 }}>{msg}</p>

      <hr style={{ margin:'16px 0' }} />
      <p style={{ color:'#666', fontSize:13 }}>
        iPad Safari에서 푸시가 느리거나 동작하지 않으면 iPadOS 16.4 이상인지, 사이트를 홈화면에 추가했는지 확인해주세요.  
        브라우저 정책상 iOS/사파리는 시스템 배터리/절전 상태에 따라 몇 분 지연될 수 있습니다.
      </p>
    </main>
  );
}
