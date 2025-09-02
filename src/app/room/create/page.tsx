'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

export default function CreateRoomPage() {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState<number | ''>('');
  const [minCapacity, setMinCapacity] = useState<number | ''>('');
  const [startAt, setStartAt] = useState('');
  const [kakao, setKakao] = useState('');
  const [msg, setMsg] = useState('');

  const onCreate = async () => {
    setMsg('생성 중…');
    try {
      const payload = {
        title: title.trim(),
        location: location.trim(),
        capacity: capacity === '' ? '' : Number(capacity),
        minCapacity: minCapacity === '' ? '' : Number(minCapacity),
        startAt: startAt ? new Date(startAt).toISOString() : '',
        kakaoOpenChatUrl: kakao.trim() || undefined,
      };
      const res = await authedFetch('/api/rooms/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      setMsg(res.ok ? `✅ 생성 완료: ${j.id}` : `❌ ${j.error} ${j.missing ? '('+j.missing.join(', ')+')' : ''}`);
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1>방 만들기(검증용)</h1>
      <div style={{ display:'grid', gap:8 }}>
        <input placeholder="제목" value={title} onChange={e=>setTitle(e.target.value)} />
        <input placeholder="장소" value={location} onChange={e=>setLocation(e.target.value)} />
        <div style={{ display:'flex', gap:8 }}>
          <input type="number" placeholder="최대 정원(예: 6)" value={capacity}
                 onChange={e=>setCapacity(e.target.value === '' ? '' : Number(e.target.value))} />
          <input type="number" placeholder="최소 정원(예: 3)" value={minCapacity}
                 onChange={e=>setMinCapacity(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
        <label>시작시간 <input type="datetime-local" value={startAt} onChange={e=>setStartAt(e.target.value)} /></label>
        <input placeholder="오픈채팅 URL(선택)" value={kakao} onChange={e=>setKakao(e.target.value)} />
        <button onClick={onCreate}>방 생성</button>
      </div>
      <p style={{ marginTop:8 }}>{msg}</p>
    </main>
  );
}
