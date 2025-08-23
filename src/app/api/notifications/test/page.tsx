// src/app/notifications/test/page.tsx
'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

export default function TestNotificationPage() {
  const [status, setStatus] = useState('');

  const send = async () => {
    setStatus('발송 중…');
    try {
      const res = await authedFetch('/api/notifications/test-send', {
        method: 'POST',
        body: JSON.stringify({
          title: '🦄 UNIcorn 테스트',
          body: '푸시 연결 테스트입니다.',
          url: '/room',
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'send failed');
      setStatus(`✅ 발송: ${j.successCount} 성공 / ${j.failureCount} 실패`);
    } catch (e: any) {
      setStatus('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>테스트 알림 보내기</h1>
      <button onClick={send}>내게 보내기</button>
      <p style={{ marginTop: 8 }}>{status}</p>
    </main>
  );
}
