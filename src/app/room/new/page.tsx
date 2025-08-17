'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { useAuthReady } from '@/hooks/useAuthReady';

export default function NewRoomPage() {
  const { ready, user } = useAuthReady();
  const [submitting, setSubmitting] = useState(false);
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

  const onChange = (e: any) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e: any) => {
    e.preventDefault();
    if (!ready || !user) return; // 안전 가드
    setSubmitting(true);
    setMsg('생성 중...');
    try {
      if (!form.date || !form.time) throw new Error('날짜/시간을 입력하세요');
      const startAt = new Date(`${form.date}T${form.time}:00`);

      const res = await authedFetch('/api/rooms/create', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type.trim(),
          content: form.content.trim(),
          location: form.location.trim(),
          startAt: startAt.toISOString(),
          capacity: Number(form.capacity),
          kakaoOpenChatUrl: form.kakaoOpenChatUrl?.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '생성 실패');
      setMsg(`✅ 생성 완료! (id: ${json.id})`);
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = ready && !!user && !submitting;

  return (
    <main style={{ padding: 24, maxWidth: 560 }}>
      <h1>모임 방 만들기</h1>

      {!ready && <p>🔄 로그인 상태 확인 중…</p>}
      {ready && !user && (
        <p style={{ color: '#c00' }}>
          로그인이 필요합니다. <a href="/login">로그인하러 가기</a>
        </p>
      )}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, opacity: canSubmit ? 1 : 0.7 }}>
        <input name="title" placeholder="제목" value={form.title} onChange={onChange} required />
        <input name="type" placeholder="모임 종류(예: 점심, 스터디)" value={form.type} onChange={onChange} />
        <textarea name="content" placeholder="모임 내용" value={form.content} onChange={onChange} />
        <input name="location" placeholder="장소" value={form.location} onChange={onChange} required />

        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" name="date" value={form.date} onChange={onChange} required />
          <input type="time" name="time" value={form.time} onChange={onChange} required />
        </div>

        <input type="number" name="capacity" min={1} max={100} value={form.capacity} onChange={onChange} />
        <input name="kakaoOpenChatUrl" placeholder="(선택) 오픈채팅 링크" value={form.kakaoOpenChatUrl} onChange={onChange} />

        <button type="submit" disabled={!canSubmit}>
          {submitting ? '생성 중…' : '방 생성'}
        </button>
      </form>

      <p style={{ marginTop: 12 }}>{msg}</p>
    </main>
  );
}
