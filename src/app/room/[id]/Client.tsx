'use client';

import { useEffect, useMemo, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  minCapacity?: number;
  startAt: string;
  endAt: string;
  revealAt?: string;
  closed?: boolean;
  participants?: string[];
  participantsCount?: number;
  kakaoOpenChatUrl?: string;
  type?: string;
  content?: string;
};

function fmt(iso?: string) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString(); // 브라우저(사용자) 타임존 기준
  } catch {
    return iso;
  }
}

export default function Client({ room }: { room: Room }) {
  const [uid, setUid] = useState<string | null>(null);
  const [joined, setJoined] = useState<boolean>(false);
  const [msg, setMsg] = useState('');

  // 내 UID
  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // 내가 참여했는지 간단 확인
  useEffect(() => {
    if (!uid) { setJoined(false); return; }
    const list = Array.isArray(room.participants) ? room.participants : [];
    setJoined(list.includes(uid));
  }, [uid, room.participants]);

  const now = new Date();
  const isClosed = !!room.closed;
  const isEnded = now >= new Date(room.endAt);
  const full = (room.capacity || 0) > 0 && (room.participantsCount || (room.participants?.length || 0)) >= room.capacity;

  const canJoin = useMemo(() => {
    if (isClosed || isEnded) return false;
    if (joined) return false;
    if (full) return false;
    return true;
  }, [isClosed, isEnded, joined, full]);

  const canLeave = useMemo(() => {
    if (isClosed || isEnded) return false;
    if (!joined) return false;
    return true;
  }, [isClosed, isEnded, joined]);

  const join = async () => {
    setMsg('참여 중…');
    try {
      const res = await authedFetch('/api/rooms/join', { method: 'POST', body: JSON.stringify({ roomId: room.id }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'join failed');
      setMsg('✅ 참여 완료');
      setJoined(true);
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };
  const leave = async () => {
    setMsg('나가는 중…');
    try {
      const res = await authedFetch('/api/rooms/leave', { method: 'POST', body: JSON.stringify({ roomId: room.id }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'leave failed');
      setMsg('✅ 나가기 완료');
      setJoined(false);
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <header style={{ display:'flex', alignItems:'baseline', gap:8, justifyContent:'space-between' }}>
        <div>
          <h1 style={{ margin: 0 }}>{room.title}</h1>
          <div style={{ color: '#555', fontSize: 13, marginTop: 4 }}>
            장소: {room.location} · 정원: {room.capacity}명{room.minCapacity ? ` (최소 ${room.minCapacity}명)` : ''}
          </div>
          <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
            시간: {fmt(room.startAt)} ~ {fmt(room.endAt)}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={join}
            disabled={!canJoin}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #ddd',
              background: canJoin ? '#111' : '#e5e7eb',
              color: canJoin ? '#fff' : '#999',
              cursor: canJoin ? 'pointer' : 'not-allowed'
            }}
            title={joined ? '이미 참여했습니다' : full ? '정원 초과' : isEnded ? '종료됨' : isClosed ? '닫힘' : '참여하기'}
          >
            참여하기
          </button>
          <button
            onClick={leave}
            disabled={!canLeave}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #ddd',
              background: canLeave ? '#fff' : '#f3f4f6',
              color: canLeave ? '#111' : '#999',
              cursor: canLeave ? 'pointer' : 'not-allowed'
            }}
            title={!joined ? '참여하지 않았습니다' : isEnded ? '종료됨' : isClosed ? '닫힘' : '나가기'}
          >
            나가기
          </button>
        </div>
      </header>

      {room.type || room.content || room.kakaoOpenChatUrl ? (
        <section style={{ border:'1px solid #e5e7eb', borderRadius: 12, padding: 12, background:'#fff' }}>
          {room.type && <div style={{ marginBottom:6 }}>종류: {room.type}</div>}
          {room.content && <div style={{ marginBottom:6 }}>내용: {room.content}</div>}
          {room.kakaoOpenChatUrl && (
            <div>
              오픈채팅:{' '}
              <a href={room.kakaoOpenChatUrl} target="_blank" rel="noreferrer">
                {room.kakaoOpenChatUrl}
              </a>
            </div>
          )}
        </section>
      ) : null}

      {msg && <p style={{ color: msg.startsWith('❌') ? 'crimson' : '#111' }}>{msg}</p>}
    </div>
  );
}
