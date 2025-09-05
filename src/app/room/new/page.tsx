'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authedFetch } from '@/lib/authedFetch';
import { useAuthReady } from '@/hooks/useAuthReady';

type FormState = {
  title: string;
  type: string;
  content: string;
  location: string;
  date: string;       // 시작 날짜 (YYYY-MM-DD)
  time: string;       // 시작 시간 (HH:mm)
  endDate: string;    // 종료 날짜 (선택)
  endTime: string;    // 종료 시간 (선택)
  capacity: number;
  minCapacity: number;
  kakaoOpenChatUrl: string;
};

export default function NewRoomPage() {
  const { ready, user } = useAuthReady();
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState<FormState>({
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

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]:
        name === 'capacity' || name === 'minCapacity'
          ? (value === '' ? '' : Number(value)) // 숫자 필드
          : value,
    }) as unknown as FormState);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ready || !user || submitting) return;

    setSubmitting(true);
    setMsg('생성 중...');

    try {
      if (!form.title.trim()) throw new Error('제목을 입력하세요.');
      if (!form.location.trim()) throw new Error('장소를 입력하세요.');
      if (!form.date || !form.time) throw new Error('시작 날짜/시간을 입력하세요.');
      if (!Number.isFinite(form.capacity) || form.capacity < 1) {
        throw new Error('최대 인원은 1명 이상이어야 합니다.');
      }
      if (!Number.isFinite(form.minCapacity) || form.minCapacity < 1) {
        throw new Error('최소 시작 인원은 1명 이상이어야 합니다.');
      }
      if (form.minCapacity > form.capacity) {
        throw new Error('최소 시작 인원이 최대 인원보다 클 수 없습니다.');
      }

      const startAt = new Date(`${form.date}T${form.time}:00`);

      let endAtIso: string | undefined;
      if (form.endDate && form.endTime) {
        const endAt = new Date(`${form.endDate}T${form.endTime}:00`);
        endAtIso = endAt.toISOString();
        if (endAt <= startAt) {
          throw new Error('종료 시간은 시작 시간보다 늦어야 합니다.');
        }
      }
      // endAt 미입력 시 서버에서 자동 +5시간 적용됨

      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        type: form.type.trim(),
        content: form.content.trim(),
        location: form.location.trim(),
        startAt: startAt.toISOString(),
        capacity: Number(form.capacity),
        minCapacity: Number(form.minCapacity),
        kakaoOpenChatUrl: form.kakaoOpenChatUrl?.trim() || null,
      };
      if (endAtIso) payload.endAt = endAtIso;

      const res = await authedFetch('/api/rooms/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message || json?.error || '생성 실패');
      }

      // 생성 성공: 홈으로 이동 (생성자는 자동 참여 상태)
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
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 12 }}>모임 방 만들기</h1>

      {!ready && <p>🔄 로그인 상태 확인 중…</p>}
      {ready && !user && (
        <p style={{ color: '#c00' }}>
          로그인이 필요합니다. <a href="/login">로그인하러 가기</a>
        </p>
      )}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, opacity: canSubmit ? 1 : 0.7 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>제목</span>
          <input
            name="title"
            placeholder="예: 점심 번개"
            value={form.title}
            onChange={onChange}
            required
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>모임 종류 (선택)</span>
          <input
            name="type"
            placeholder="예: 점심, 스터디, 번개 등"
            value={form.type}
            onChange={onChange}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>모임 내용 (선택)</span>
          <textarea
            name="content"
            placeholder="모임에 대한 간단 설명"
            value={form.content}
            onChange={onChange}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>장소</span>
          <input
            name="location"
            placeholder="예: 학생회실, 정문 앞, OO카페"
            value={form.location}
            onChange={onChange}
            required
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>시작 날짜</span>
            <input type="date" name="date" value={form.date} onChange={onChange} required />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>시작 시간</span>
            <input type="time" name="time" value={form.time} onChange={onChange} required />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>종료 날짜 (선택)</span>
            <input type="date" name="endDate" value={form.endDate} onChange={onChange} />
            <small style={{ color: '#666' }}>
              미입력 시 시작 후 <b>자동 5시간</b>으로 설정됩니다.
            </small>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>종료 시간 (선택)</span>
            <input type="time" name="endTime" value={form.endTime} onChange={onChange} />
            <small style={{ color: '#666' }}>
              종료를 지정하려면 날짜와 시간을 모두 입력하세요. 시작보다 <b>늦어야</b> 합니다.
            </small>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>최대 인원(정원)</span>
            <input
              type="number"
              name="capacity"
              min={1}
              max={100}
              value={form.capacity}
              onChange={onChange}
              required
            />
            <small style={{ color: '#666' }}>
              이 수를 초과하면 더 이상 참여할 수 없어요. (예: 6)
            </small>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>최소 시작 인원</span>
            <input
              type="number"
              name="minCapacity"
              min={1}
              max={100}
              value={form.minCapacity}
              onChange={onChange}
              required
            />
            <small style={{ color: '#666' }}>
              모임 시작 전까지 이 인원을 채우지 못하면 자동 취소돼요. (예: 3)
            </small>
          </label>
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>오픈채팅 링크 (선택)</span>
          <input
            name="kakaoOpenChatUrl"
            placeholder="https://open.kakao.com/..."
            value={form.kakaoOpenChatUrl}
            onChange={onChange}
          />
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
