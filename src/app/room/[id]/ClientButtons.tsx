'use client';

import { useEffect, useMemo, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export default function ClientButtons({
  roomId,
  closed,
  startAt,
  endAt,
  capacity,
  participantsCount,
  participants,
}: {
  roomId: string;
  closed: boolean;
  startAt: string;
  endAt: string;
  capacity: number;
  participantsCount: number;
  participants: string[];
}) {
  const [msg, setMsg] = useState('');
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  const now = new Date();
  const isClosed = !!closed;
  const isStarted = now >= new Date(startAt);
  const isEnded = now >= new Date(endAt);

  const isParticipant = useMemo(() => {
    if (!uid) return false;
    return participants?.includes(uid);
  }, [participants, uid]);

  const isFull = useMemo(() => {
    const cap = Math.max(0, Number(capacity || 0));
    const joined = Math.max(0, Number(participantsCount || 0));
    return cap > 0 && joined >= cap;
  }, [capacity, participantsCount]);

  const canJoin = useMemo(() => {
    if (!uid) return false;
    if (isClosed || isEnded) return false;
    if (isParticipant) return false;
    if (isFull) return false;
    return true;
  }, [uid, isClosed, isEnded, isParticipant, isFull]);

  const canLeave = useMemo(() => {
    if (!uid) return false;
    if (isClosed || isEnded) return false;
    if (!isParticipant) return false;
    // 시작 후 나가기 금지 정책 유지
    if (isStarted) return false;
    return true;
  }, [uid, isClosed, isEnded, isParticipant, isStarted]);

  const join = async () => {
    setMsg('참여 중…');
    try {
      const res = await authedFetch('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ roomId }),
      });
      const j = await res.json();
      if (!res.ok) return setMsg('❌ ' + (j?.error || 'join failed'));
      setMsg('✅ 참여 완료');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  const leave = async () => {
    setMsg('나가는 중…');
    try {
      const res = await authedFetch('/api/rooms/leave', {
        method: 'POST',
        body: JSON.stringify({ roomId }),
      });
      const j = await res.json();
      if (!res.ok) return setMsg('❌ ' + (j?.error || 'leave failed'));
      setMsg('✅ 나가기 완료');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button onClick={join} disabled={!canJoin} style={{ padding: '8px 12px' }}>
        참여하기
      </button>
      <button onClick={leave} disabled={!canLeave} style={{ padding: '8px 12px' }}>
        나가기
      </button>
      <span style={{ color: msg.startsWith('❌') ? 'crimson' : '#333' }}>{msg}</span>
    </div>
  );
}
