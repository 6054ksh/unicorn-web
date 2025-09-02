'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import type { FeedbackStatus } from '@/types/firestore';

type Row = {
  id: string;
  userUid?: string|null;
  category: 'bug' | 'idea' | 'other';
  message: string;
  contact?: string;
  status: FeedbackStatus;
  createdAt: string;
  lastUpdatedAt?: string;
  ua?: string;
  referer?: string;
};

export default function AdminFeedbackPage() {
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('open');
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState('');

  const fetchList = async () => {
    setMsg('불러오는 중…');
    try {
      const res = await authedFetch(`/api/admin/feedback/list?status=${status}&limit=200`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'fail');
      setRows(j.list || []);
      setMsg('');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
      setRows([]);
    }
  };

  useEffect(() => { fetchList(); /*eslint-disable-next-line*/ }, [status]);

  const updateStatus = async (id: string, s: FeedbackStatus) => {
    setMsg('상태 변경 중…');
    try {
      const res = await authedFetch('/api/admin/feedback/update', {
        method: 'POST',
        body: JSON.stringify({ id, status: s }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'fail');
      setMsg('✅ 상태 변경 완료');
      fetchList();
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <main style={{ padding:24, maxWidth:1000, margin:'0 auto', background:'#fafbfd' }}>
      <h1 style={{ marginBottom: 12 }}>어드민 · 피드백 관리</h1>

      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        {(['all','open','in_progress','resolved'] as const).map(s => (
          <button
            key={s}
            onClick={()=>setStatus(s)}
            style={{
              padding:'8px 12px',
              background: status === s ? '#2563eb' : '#eef2ff',
              color: status === s ? '#fff' : '#1e293b',
              borderRadius: 10, border:'1px solid #dbeafe', fontWeight: 700
            }}
          >
            {s === 'all' ? '전체' : s === 'open' ? '열림' : s === 'in_progress' ? '처리중' : '해결됨'}
          </button>
        ))}
      </div>

      {msg && <p style={{ color: msg.startsWith('✅') ? '#15803d' : '#dc2626' }}>{msg}</p>}

      <div style={{ display:'grid', gap:10 }}>
        {rows.map(r => (
          <div key={r.id} style={{ border:'1px solid #e6ebf3', borderRadius:12, padding:12, background:'#fff' }}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
              <div>
                <b>[{r.category}]</b> {r.message}
                <div style={{ color:'#64748b', fontSize:12, marginTop:6 }}>
                  {r.userUid ? <>UID: <code>{r.userUid}</code> · </> : null}
                  작성: {new Date(r.createdAt).toLocaleString()}
                  {r.contact ? <> · 연락처: {r.contact}</> : null}
                </div>
                {(r.ua || r.referer) && (
                  <div style={{ color:'#94a3b8', fontSize:12, marginTop:4 }}>
                    {r.referer ? <>from: {r.referer} · </> : null}
                    ua: {r.ua?.slice(0,120)}{r.ua && r.ua.length>120 ? '…' : ''}
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'start' }}>
                {(['open','in_progress','resolved'] as const).map(s => (
                  <button
                    key={s}
                    onClick={()=>updateStatus(r.id, s)}
                    style={{
                      padding:'6px 10px', borderRadius:8,
                      background: r.status === s ? '#22c55e' : '#f1f5f9',
                      color: r.status === s ? '#fff' : '#0f172a',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    {s === 'open' ? '열림' : s === 'in_progress' ? '처리중' : '해결됨'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {!rows.length && <div style={{ color:'#64748b' }}>표시할 항목이 없습니다.</div>}
      </div>
    </main>
  );
}
