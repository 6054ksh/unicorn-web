// src/app/room/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/authedFetch';
import { useAuthReady } from '@/hooks/useAuthReady';

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
    endDate: '',
    endTime: '',
    capacity: 6,
    minCapacity: 3,
    kakaoOpenChatUrl: '',
  });
  const [msg, setMsg] = useState('');

  const onChange = (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !user) return;
    setSubmitting(true);
    setMsg('생성 중...');

    try {
      if (!form.date || !form.time) throw new Error('시작 날짜/시간을 입력하세요');

      const startAt = new Date(`${form.date}T${form.time}:00`);
      let endAtIso: string | undefined = undefined;
      if (form.endDate && form.endTime) {
        const endAt = new Date(`${form.endDate}T${form.endTime}:00`);
        if (isNaN(endAt.getTime())) throw new Error('종료 시간 형식이 올바르지 않습니다.');
        if (endAt <= startAt) throw new Error('종료 시간은 시작 시간 이후여야 합니다.');
        endAtIso = endAt.toISOString();
      }

      const res = await authedFetch('/api/rooms/create', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type.trim(),
          content: form.content.trim(),
          location: form.location.trim(),
          startAt: startAt.toISOString(),
          endAt: endAtIso,            // 없으면 서버에서 +5h 자동
          capacity: Number(form.capacity),
          minCapacity: Number(form.minCapacity),
          kakaoOpenChatUrl: form.kakaoOpenChatUrl?.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '생성 실패');

      setMsg(`✅ 생성 완료!`);
      router.replace('/');           // 생성 후 홈으로
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = ready && !!user && !submitting;

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>모임 방 만들기 🎉</h1>
        <p style={{ margin: '6px 0 0', color: '#666' }}>
          제목과 시간, 장소만 정하면 끝! 아래 가이드를 참고하세요.
        </p>
      </div>

      {!ready && <p>🔄 로그인 상태 확인 중…</p>}
      {ready && !user && (
        <p style={{ color: '#c00' }}>
          로그인이 필요합니다. <a href="/login">로그인하러 가기</a>
        </p>
      )}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14, opacity: canSubmit ? 1 : 0.7 }}>
        <div
          style={{
            display: 'grid',
            gap: 12,
            border: '1px solid #f0f0f2',
            padding: 16,
            borderRadius: 16,
            background: '#fff',
          }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span>제목</span>
            <input name="title" placeholder="예: 점심 번개, 저녁 보드게임" value={form.title} onChange={onChange} required />
          </label>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>모임 종류 (선택)</span>
              <input name="type" placeholder="예: 점심, 스터디, 운동" value={form.type} onChange={onChange} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>장소</span>
              <input name="location" placeholder="예: 학생회실, 정문 앞, OO카페" value={form.location} onChange={onChange} required />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>설명 (선택)</span>
            <textarea name="content" placeholder="간단한 설명을 적어주세요" value={form.content} onChange={onChange} />
          </label>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>시작 날짜</span>
              <input type="date" name="date" value={form.date} onChange={onChange} required />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>시작 시간</span>
              <input type="time" name="time" value={form.time} onChange={onChange} required />
            </label>
          </div>

          <details style={{ background:'#fafafa', border:'1px dashed #e5e7eb', borderRadius:12, padding:12 }}>
            <summary style={{ cursor:'pointer', fontWeight:700 }}>종료 시간 직접 설정 (선택)</summary>
            <div style={{ marginTop: 10, display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>종료 날짜</span>
                <input type="date" name="endDate" value={form.endDate} onChange={onChange} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>종료 시간</span>
                <input type="time" name="endTime" value={form.endTime} onChange={onChange} />
              </label>
              <p style={{ gridColumn: '1 / -1', color:'#666', margin:0 }}>
                ※ 입력하지 않으면 자동으로 시작 +5시간으로 설정돼요.
              </p>
            </div>
          </details>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>최대 정원</span>
              <input type="number" name="capacity" min={1} max={100} value={form.capacity} onChange={onChange} />
              <small style={{ color:'#777' }}>모임에 참여할 수 있는 최대 인원</small>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>최소 인원</span>
              <input type="number" name="minCapacity" min={1} max={100} value={form.minCapacity} onChange={onChange} />
              <small style={{ color:'#777' }}>이 인원 미만이면 모임이 시작되지 않아요 (자동 취소 처리)</small>
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>오픈채팅 URL (선택)</span>
            <input
              name="kakaoOpenChatUrl"
              placeholder="예: https://open.kakao.com/o/xxxx"
              value={form.kakaoOpenChatUrl}
              onChange={onChange}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #111',
              background: '#111',
              color: '#fff',
              fontWeight: 800,
              cursor: canSubmit ? 'pointer' : 'not-allowed'
            }}
          >
            {submitting ? '생성 중…' : '방 생성'}
          </button>
          <span style={{ color: msg.startsWith('❌') ? 'crimson' : '#333' }}>{msg}</span>
        </div>

        <div style={{ marginTop: 8 }}>
          <a href="/" style={{ textDecoration:'none', color:'#111', fontWeight:700 }}>← 홈으로</a>
        </div>
      </form>
    </main>
  );
}
