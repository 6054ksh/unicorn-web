'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

type Item = {
  id: string;
  uid: string;
  name: string;
  profileImage?: string;
  text: string;
  createdAt: string;
  likesCount: number;
  liked: boolean;
};

export default function FeedbackPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const autoRef = useRef<NodeJS.Timeout | null>(null);
  const [auto, setAuto] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await authedFetch('/api/feedback/list?limit=100');
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'fetch failed');
      setItems(j.items || []);
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!auto) { if (autoRef.current) clearInterval(autoRef.current); autoRef.current = null; return; }
    autoRef.current = setInterval(load, 10000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [auto]);

  const onSubmit = async () => {
    const body = text.trim();
    if (!body) return;
    setMsg('작성 중…');
    try {
      const res = await authedFetch('/api/feedback/create', {
        method: 'POST',
        body: JSON.stringify({ text: body }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || '작성 실패');
      setText('');
      setMsg('✅ 등록 완료');
      await load();
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  const toggleLike = async (id: string) => {
    try {
      const res = await authedFetch('/api/feedback/toggle-like', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'toggle failed');
      setItems((arr) =>
        arr.map((it) =>
          it.id === id ? { ...it, liked: j.liked, likesCount: j.likesCount } : it
        )
      );
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  const human = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <main style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>방명록</h1>
      <p style={{ color:'#666', marginBottom: 12 }}>가볍게 의견/피드백을 남겨주세요. (최대 500자)</p>

      {/* 입력 영역 (라이트 코멘트 박스) */}
      <div style={{
        border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fbfbff',
        boxShadow: '0 1px 0 rgba(0,0,0,.03)'
      }}>
        <textarea
          placeholder="예: 이번 모임 장소 너무 좋았어요! 다음엔 6시 이후로 부탁 🙌"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          style={{ width: '100%', resize: 'vertical', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button onClick={onSubmit} style={{ padding: '8px 12px', borderRadius: 8, background: '#111', color: '#fff' }}>
            등록
          </button>
          <button onClick={load} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd' }}>
            새로고침
          </button>
          <label style={{ marginLeft: 'auto', fontSize: 12, color: '#555', display:'flex', alignItems:'center', gap:6 }}>
            <input type="checkbox" checked={auto} onChange={(e)=>setAuto(e.target.checked)} /> 자동 새로고침(10초)
          </label>
        </div>
        {msg && <p style={{ marginTop: 8, color: msg.startsWith('❌') ? 'crimson' : '#2e7d32' }}>{msg}</p>}
      </div>

      <div style={{ height: 12 }} />

      {/* 목록 */}
      {loading && <p>불러오는 중…</p>}
      {!loading && !items.length && <p style={{ color:'#666' }}>아직 글이 없습니다.</p>}

      <div style={{ display:'grid', gap: 10 }}>
        {items.map((it) => (
          <div key={it.id} style={{
            border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff',
            boxShadow: '0 1px 0 rgba(0,0,0,.02)'
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {it.profileImage ? (
                <img src={it.profileImage} alt="" style={{ width:28, height:28, borderRadius:'50%' }} />
              ) : (
                <div style={{ width:28, height:28, borderRadius:'50%', background:'#eef2ff',
                  display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'#3730a3' }}>U</div>
              )}
              <div style={{ fontWeight: 600 }}>{it.name}</div>
              <div style={{ marginLeft:'auto', fontSize:12, color:'#666' }}>{human(it.createdAt)}</div>
            </div>
            <div style={{ marginTop: 8, whiteSpace:'pre-wrap', lineHeight: 1.5 }}>{it.text}</div>

            <div style={{ display:'flex', gap:8, alignItems:'center', marginTop: 10 }}>
              <button
                onClick={() => toggleLike(it.id)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid ' + (it.liked ? '#2563eb' : '#e5e7eb'),
                  background: it.liked ? '#eff6ff' : '#fff',
                  color: it.liked ? '#1d4ed8' : '#111',
                  cursor: 'pointer'
                }}
              >
                👍 좋아요 {it.likesCount}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
