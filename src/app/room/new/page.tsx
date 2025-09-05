'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { useAuthReady } from '@/hooks/useAuthReady';
import { useRouter } from 'next/navigation';

export default function NewRoomPage() {
  const { ready, user } = useAuthReady();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    type: '',
    content: '',
    location: '',
    date: '',
    time: '',
    capacity: 6,
    minCapacity: 3,              // ← 최소정원
    kakaoOpenChatUrl: '',
  });
  const [msg, setMsg] = useState('');

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !user || submitting) return;
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
          minCapacity: Number(form.minCapacity),           // ← 전달
          kakaoOpenChatUrl: form.kakaoOpenChatUrl?.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '생성 실패');

      // 생성자 자동 참여는 서버에서 처리됨.
      // 성공 시 홈으로 이동
      setMsg('✅ 생성 완료! 홈으로 이동합니다...');
      router.replace('/');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = ready && !!user && !submitting;

  return (
    <main style={{ padding: 24, maxWidth: 620 }}>
      <h1>모임 방 만들기</h1>

      {!ready && <p>🔄 로그인 상태 확인 중…</p>}
      {ready && !user && (
        <p style={{ color: '#c00' }}>
          로그인이 필요합니다. <a href="/login">로그인하러 가기</a>
        </p>
      )}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, opacity: canSubmit ? 1 : 0.7 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>제목</span>
          <input name="title" placeholder="예: 점심 번개" value={form.title} onChange={onChange} required />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>모임 종류 (선택)</span>
          <input name="type" placeholder="예: 점심, 스터디, 번개 등" value={form.type} onChange={onChange} />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>모임 내용 (선택)</span>
          <textarea name="content" placeholder="모임에 대한 간단 설명" value={form.content} onChange={onChange} />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>장소</span>
          <input name="location" placeholder="예: 학생회실, 정문 앞, OO카페" value={form.location} onChange={onChange} required />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>날짜</span>
            <input type="date" name="date" value={form.date} onChange={onChange} required />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>시간</span>
            <input type="time" name="time" value={form.time} onChange={onChange} required />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>최대 인원(정원)</span>
            <input type="number" name="capacity" min={1} max={100} value={form.capacity} onChange={onChange} />
            <small style={{ color: '#666' }}>
              이 수를 초과하면 더 이상 참여할 수 없어요. (예: 6)
            </small>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>최소 시작 인원</span>
            <input type="number" name="minCapacity" min={1} max={100} value={form.minCapacity} onChange={onChange} />
            <small style={{ color: '#666' }}>
              모임 시작 전까지 이 인원을 채우지 못하면 자동 취소돼요. (예: 3)
            </small>
          </label>
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>오픈채팅 링크 (선택)</span>
          <input name="kakaoOpenChatUrl" placeholder="https://open.kakao.com/..." value={form.kakaoOpenChatUrl} onChange={onChange} />
          <small style={{ color: '#666' }}>
            모임 시작 1시간 전 공개되는 링크예요.
          </small>
        </label>

        <button type="submit" disabled={!canSubmit}>
          {submitting ? '생성 중…' : '방 생성'}
        </button>
      </form>

      <p style={{ marginTop: 12 }}>{msg}</p>
    </main>
  );
}
