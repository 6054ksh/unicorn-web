'use client';

import { useMemo, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

export default function ClientButtons({
  roomId,
  closed,
  startAt,
  endAt,
  joinLockUntil,
}: {
  roomId: string;
  closed: boolean;
  startAt: string;
  endAt: string;
  joinLockUntil?: string;
}) {
  const [msg, setMsg] = useState('');

  const now = new Date();
  const isClosed = !!closed;
  const isStarted = now >= new Date(startAt);
  const isEnded = now >= new Date(endAt);
  const isJoinLocked = joinLockUntil ? now < new Date(joinLockUntil) : false;

  const canJoin = useMemo(() => {
    if (isClosed || isEnded) return false;
    if (isJoinLocked) return false;
    return true;
  }, [isClosed, isEnded, isJoinLocked]);

  const canLeave = useMemo(() => {
    if (isClosed || isEnded) return false;
    if (isStarted) return false; // 시작 후 나가기 금지
    return true;
  }, [isClosed, isEnded, isStarted]);

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
