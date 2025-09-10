// src/app/admin/scores/reset/page.tsx
'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

type Res = {
  ok?: boolean;
  dryRun?: boolean;
  found?: number;
  reset?: number;
  error?: string;
  hint?: string;
};

export default function AdminScoresResetPage() {
  const [dry, setDry] = useState<Res | null>(null);
  const [done, setDone] = useState<Res | null>(null);
  const [status, setStatus] = useState<string>('');

  const dryRun = async () => {
    setStatus('드라이런 실행 중…');
    setDry(null);
    setDone(null);
    try {
      const res = await authedFetch('/api/admin/scores/reset', { method: 'POST' });
      const j: Res = await res.json();
      if (!res.ok) throw new Error(j?.error || '실패');
      setDry(j);
      setStatus('드라이런 완료');
    } catch (e: any) {
      setStatus('❌ ' + (e?.message ?? String(e)));
    }
  };

  const doReset = async () => {
    if (!confirm('정말 점수판을 0으로 초기화할까요? 되돌릴 수 없습니다.')) return;
    setStatus('초기화 실행 중…');
    setDone(null);
    try {
      const res = await authedFetch('/api/admin/scores/reset?confirm=1', { method: 'POST' });
      const j: Res = await res.json();
      if (!res.ok) throw new Error(j?.error || '실패');
      setDone(j);
      setStatus('✅ 초기화 완료');
    } catch (e: any) {
      setStatus('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>점수판 초기화 (관리자)</h1>
      <p style={{ color: '#555', marginTop: 0 }}>
        이 페이지는 <code>admins/{'{'}uid{'}'}</code> 문서에 <code>isAdmin: true</code>가 설정된 계정만 사용할 수 있어요.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={dryRun} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd' }}>
          1) 드라이런(미리보기)
        </button>
        <button
          onClick={doReset}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#111', color: '#fff' }}
        >
          2) 초기화 실행(되돌릴 수 없음)
        </button>
      </div>

      {status && <p style={{ marginTop: 10 }}>{status}</p>}

      {dry && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid #eee',
            borderRadius: 8,
            background: '#fafafa',
            whiteSpace: 'pre-wrap',
          }}
        >
{JSON.stringify(dry, null, 2)}
        </pre>
      )}

      {done && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            border: '1px solid #eee',
            borderRadius: 8,
            background: '#f0fdf4',
            whiteSpace: 'pre-wrap',
          }}
        >
{JSON.stringify(done, null, 2)}
        </pre>
      )}
    </main>
  );
}
