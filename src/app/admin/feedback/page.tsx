'use client';

import { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

type Item = {
  id: string;
  name: string;
  text: string;
  createdAt: string;
  likesCount: number;
};

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setMsg('');
    try {
      const res = await authedFetch('/api/feedback/list?limit=200');
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'fetch failed');
      setItems((j.items || []).map((x: any) => ({
        id: x.id, name: x.name, text: x.text, createdAt: x.createdAt, likesCount: x.likesCount
      })));
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  useEffect(() => { load(); }, []);

  const removeItem = async (id: string) => {
    if (!confirm('정말 삭제할까요?')) return;
    setMsg('삭제 중…');
    try {
      const res = await authedFetch('/api/admin/feedback/delete', { method: 'POST', body: JSON.stringify({ id }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'delete failed');
      setMsg('✅ 삭제 완료');
      await load();
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  const human = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1>어드민 · 방명록 관리</h1>
      <p style={{ color: '#666' }}>사용자 피드백을 삭제할 수 있습니다.</p>
      <div style={{ marginTop: 8, display:'flex', gap:8 }}>
        <button onClick={load} style={{ padding:'6px 10px', border:'1px solid #ddd', borderRadius:8 }}>새로고침</button>
        <span>{msg}</span>
      </div>

      <div style={{ marginTop: 12, display:'grid', gap:10 }}>
        {items.map(it => (
          <div key={it.id} style={{ border:'1px solid #eee', borderRadius:12, padding:12, background:'#fff' }}>
            <div style={{ display:'flex', gap:8, alignItems:'baseline' }}>
              <b>{it.name}</b>
              <span style={{ marginLeft:'auto', fontSize:12, color:'#666' }}>{human(it.createdAt)}</span>
            </div>
            <div style={{ marginTop:6, whiteSpace:'pre-wrap' }}>{it.text}</div>
            <div style={{ marginTop:8, fontSize:12, color:'#666' }}>👍 {it.likesCount}</div>
            <div style={{ marginTop:8 }}>
              <button onClick={() => removeItem(it.id)} style={{ padding:'6px 10px', background:'#c62828', color:'#fff', borderRadius:8 }}>
                삭제
              </button>
            </div>
          </div>
        ))}
        {!items.length && <p style={{ color:'#666' }}>항목이 없습니다.</p>}
      </div>
    </main>
  );
}
