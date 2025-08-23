// src/app/room/new/page.tsx
'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { useAuthReady } from '@/hooks/useAuthReady';
import Link from 'next/link';

export default function NewRoomPage() {
  const { ready, user } = useAuthReady();
  const [submitting, setSubmitting] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    type: '',
    content: '',
    location: '',
    date: '',
    time: '',
    capacity: 4,
    kakaoOpenChatUrl: '',
  });
  const [msg, setMsg] = useState('');

  const onChange = (e: any) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e: any) => {
    e.preventDefault();
    if (!ready || !user) return;
    setSubmitting(true); setMsg('생성 중…'); setId(null);
    try {
      if (!form.date || !form.time) throw new Error('날짜/시간을 입력하세요');
      const startAt = new Date(`${form.date}T${form.time}:00`);
      const res = await authedFetch('/api/rooms/create', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type.trim() || undefined,
          content: form.content.trim() || undefined,
          location: form.location.trim(),
          startAt: startAt.toISOString(),            // 종료시간은 서버에서 +5시간 자동 적용
          capacity: Number(form.capacity),
          kakaoOpenChatUrl: form.kakaoOpenChatUrl?.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '생성 실패');
      setId(json.id);
      setMsg('✅ 생성 완료!');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = ready && !!user && !submitting;

  return (
    <main style={{ padding: 24, maxWidth: 640, margin:'0 auto' }}>
      <h1>모임 방 만들기</h1>

      {!ready && <p>🔄 로그인 상태 확인 중…</p>}
      {ready && !user && (
        <p style={{ color: '#c00' }}>
          로그인이 필요합니다. <a href="/login">로그인하러 가기</a>
        </p>
      )}

      <form onSubmit={onSubmit} style={{ display:'grid', gap: 10, opacity: canSubmit ? 1 : 0.7, marginTop:8 }}>
        <label>제목<input name="title" required value={form.title} onChange={onChange} style={input} /></label>
        <label>종류(예: 점심, 스터디)<input name="type" value={form.type} onChange={onChange} style={input} /></label>
        <label>내용<textarea name="content" value={form.content} onChange={onChange} style={{ ...input, height:90 }} /></label>
        <label>장소<input name="location" required value={form.location} onChange={onChange} style={input} /></label>

        <div style={{ display:'flex', gap:8 }}>
          <label style={{ flex:1 }}>날짜<input type="date" name="date" required value={form.date} onChange={onChange} style={input} /></label>
          <label style={{ width:180 }}>시간<input type="time" name="time" required value={form.time} onChange={onChange} style={input} /></label>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <label style={{ width:140 }}>정원<input type="number" name="capacity" min={1} max={100} value={form.capacity} onChange={onChange} style={input} /></label>
          <label style={{ flex:1 }}>(선택) 오픈채팅 URL<input name="kakaoOpenChatUrl" value={form.kakaoOpenChatUrl} onChange={onChange} style={input} /></label>
        </div>

        <button type="submit" disabled={!canSubmit} style={btnPrimary}>
          {submitting ? '생성 중…' : '방 생성'}
        </button>
      </form>

      <p style={{ marginTop: 10 }}>{msg}</p>
      {id && (
        <div style={{ marginTop:10, display:'flex', gap:8 }}>
          <Link href={`/room/${id}`} style={btnSecondary}>방 상세보기</Link>
          <Link href="/room" style={btnSecondary}>모임목록</Link>
        </div>
      )}
    </main>
  );
}

const input: React.CSSProperties = { padding:'8px 10px', border:'1px solid #ddd', borderRadius:8, background:'#fff', width:'100%' };
const btnPrimary: React.CSSProperties = { padding:'10px 14px', borderRadius:10, background:'#111', color:'#fff', border:'1px solid #111' };
const btnSecondary: React.CSSProperties = { padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, textDecoration:'none', color:'#111', background:'#fff' };
