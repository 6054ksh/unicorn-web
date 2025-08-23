// src/app/notifications/test/page.tsx
'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import Link from 'next/link';

export default function PushTestPage() {
  const [msg, setMsg] = useState('');

  const sendTest = async () => {
    setMsg('발송 중…');
    try {
      const res = await authedFetch('/api/dev/push-test', { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || '발송 실패');
      setMsg('✅ 알림 발송 요청 성공 (몇 초 내 수신 확인)');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 640, margin:'0 auto' }}>
      <h1>알림 테스트</h1>
      <p>1) <Link href="/notifications/enable">알림 설정</Link>에서 권한 허용 & 토큰 등록</p>
      <p>2) 아래 버튼으로 내 기기에 테스트 알림 보내기</p>
      <button onClick={sendTest} style={{ padding:'10px 14px', borderRadius:10, background:'#111', color:'#fff', border:'1px solid #111' }}>
        테스트 알림 보내기
      </button>
      <p style={{ marginTop:10 }}>{msg}</p>
    </main>
  );
}
