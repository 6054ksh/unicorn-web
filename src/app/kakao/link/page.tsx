// src/app/kakao/link/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

export default function KakaoLinkPage() {
  const [status, setStatus] = useState('');
  const [code, setCode] = useState<string>('');

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setCode(sp.get('code') || '');
  }, []);

  const confirm = async () => {
    try {
      setStatus('연동 중…');
      const res = await authedFetch('/api/kakao/link/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'link failed');
      setStatus('✅ 연동이 완료되었습니다! 이제 카카오 알림을 받을 수 있어요.');
    } catch (e: any) {
      setStatus('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1>카카오 계정 연동</h1>
      <p>버튼을 누르면 현재 로그인된 계정과 카카오톡을 연결합니다.</p>
      <button onClick={confirm} disabled={!code}>연동 완료</button>
      <p style={{ marginTop: 8 }}>{status}</p>
    </main>
  );
}
