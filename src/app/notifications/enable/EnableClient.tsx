'use client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React, { useEffect, useState } from 'react';
import { requestAndGetFcmToken, listenForeground } from '@/lib/firebaseMessaging';
import { authedFetch } from '@/lib/authedFetch';

export default function EnableNotificationsPage() {
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied' | 'error'>('idle');
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [testTitle, setTestTitle] = useState('테스트 알림');
  const [testBody, setTestBody] = useState('UNIcorn 알림이 잘 오는지 확인해요!');

  useEffect(() => {
    // 포그라운드 수신 로그
    const unsub = listenForeground((payload) => {
      console.log('🔔 onMessage:', payload);
    });
    return () => {
      try { (unsub as any)?.(); } catch {}
    };
  }, []);

  const onRegister = async () => {
    setMsg('');
    if (!('Notification' in window)) {
      setMsg('이 브라우저는 알림을 지원하지 않습니다. (iOS는 16.4+에서 Safari/홈화면 앱에서 허용 필요)');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      setStatus(perm === 'denied' ? 'denied' : 'idle');
      setMsg('알림 권한을 허용해야 합니다.');
      return;
    }
    setStatus('granted');

    const t = await requestAndGetFcmToken();
    setToken(t);
    if (!t) {
      setStatus('error');
      setMsg('FCM 토큰 발급 실패 (브라우저/권한 상태를 확인하세요)');
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
        setMsg('✅ 알림 설정 완료');
      }
    } catch (e) {
      setStatus('error');
      setMsg('토큰 등록 에러');
    }
  };

  const sendTestToMe = async () => {
    setMsg('테스트 전송 중…');
    try {
      const res = await authedFetch('/api/test/notify-me', {
        method: 'POST',
        body: JSON.stringify({ title: testTitle, body: testBody }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || '전송 실패');
      setMsg('✅ 테스트 발송 완료 (잠시 후 도착합니다)');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1>알림 설정</h1>
      <p style={{ color: '#555' }}>
        브라우저 알림 권한을 허용하고, 내 기기 토큰을 등록합니다. iOS/iPadOS는 iOS 16.4 이상에서 Safari 또는
        홈 화면에 추가(PWA) 후 알림 허용이 필요할 수 있어요.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        <button onClick={onRegister} style={{ padding: '8px 12px', borderRadius: 8 }}>
          알림 권한 요청 & 토큰 등록
        </button>
        <span>{status === 'granted' ? '✅ 권한 허용됨' : `상태: ${status}`}</span>
      </div>

      {token ? (
        <p style={{ wordBreak: 'break-all', marginTop: 8 }}>
          토큰: <code>{token}</code>
        </p>
      ) : null}

      <hr style={{ margin: '16px 0' }} />

      <h2>테스트 알림 보내기</h2>
      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>제목</span>
          <input value={testTitle} onChange={(e) => setTestTitle(e.target.value)} />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>내용</span>
          <input value={testBody} onChange={(e) => setTestBody(e.target.value)} />
        </label>
        <button onClick={sendTestToMe} style={{ padding: '8px 12px', borderRadius: 8 }}>
          나에게 테스트 알림 보내기
        </button>
      </div>

      <p style={{ marginTop: 12, color: msg.startsWith('❌') ? 'crimson' : '#333' }}>{msg}</p>

      <div style={{ marginTop: 18, fontSize: 13, color: '#666' }}>
        <details>
          <summary>iOS / iPadOS에서 알림이 안 올 때</summary>
          <ul>
            <li>iOS 16.4 이상인지 확인</li>
            <li>사파리에서 이 사이트를 “홈 화면에 추가”하고 그 아이콘으로 실행</li>
            <li>첫 실행 시 “알림 허용” 수락</li>
            <li>저전력 모드/데이터 절약 모드 해제 권장</li>
          </ul>
        </details>
      </div>
    </main>
  );
}
