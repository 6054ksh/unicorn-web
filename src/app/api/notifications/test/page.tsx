// src/app/notifications/test/page.tsx
'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

export default function NotificationTestPage() {
  const [msg, setMsg] = useState('');

  const ping = async () => {
    setMsg('전송 중…');
    try {
      const res = await authedFetch('/api/me/notify-test', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'send failed');
      setMsg(`✅ 전송 완료 (성공:${j.successCount} 실패:${j.failureCount})`);
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>알림 테스트</h1>
      <p style={{ color:'#666' }}>먼저 <a href="/notifications/enable">알림 설정</a>에서 권한/토큰 등록을 해두세요.</p>
      <button onClick={ping} style={btnPrimary}>테스트 알림 보내기</button>
      <p style={{ marginTop: 12 }}>{msg}</p>
    </main>
  );
}

const btnPrimary: React.CSSProperties = {
  padding:'10px 14px', borderRadius:10, border:'1px solid #111',
  background:'#111', color:'#fff', cursor:'pointer'
};
