'use client';

import { useEffect, useState } from 'react';
import { firebaseApp } from '@/lib/firebase';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

export default function AnonPushOptIn() {
  const [supported, setSupported] = useState<boolean>(false);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setSupported(await isSupported());
      } catch {
        setSupported(false);
      }
    })();
  }, []);

  const subscribe = async () => {
    try {
      setMsg('알림 권한 확인 중…');
      if (!supported) throw new Error('이 브라우저는 푸시를 지원하지 않아요.');
      const messaging = getMessaging(firebaseApp);

      // VAPID 키는 환경변수에 넣어두셨죠? (웹 푸시용 공개키)
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;
      const token = await getToken(messaging, { vapidKey });
      if (!token) throw new Error('토큰을 발급받지 못했어요.');

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, ua: navigator.userAgent }),
      });
      if (!res.ok) throw new Error('구독 저장 실패');

      setSubscribed(true);
      setMsg('✅ 이제 새 모임 알림을 받아요!');
    } catch (e: any) {
      setSubscribed(false);
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  const unsubscribe = async () => {
    try {
      setMsg('구독 해지 중…');
      // 현재 토큰을 알아내려면 다시 getToken 호출
      const messaging = getMessaging(firebaseApp);
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;
      const token = await getToken(messaging, { vapidKey });
      if (!token) throw new Error('토큰이 없어요.');

      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      setSubscribed(false);
      setMsg('✅ 알림 구독을 해지했어요.');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  // 작게, 구석에 배치: 레이아웃 어디든 넣어두세요.
  return supported ? (
    <div style={{
      position: 'fixed', right: 12, bottom: 12, zIndex: 1000,
      display: 'grid', gap: 6, justifyItems: 'end'
    }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={subscribe}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#111', color: '#fff' }}>
          🔔 새 모임 알림 받기
        </button>
        <button onClick={unsubscribe}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>
          알림 해지
        </button>
      </div>
      {msg && <div style={{ fontSize: 12, color: msg.startsWith('❌') ? 'crimson' : '#111' }}>{msg}</div>}
    </div>
  ) : null;
}
