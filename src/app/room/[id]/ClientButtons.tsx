'use client';

import { useEffect, useMemo, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';

export default function ClientButtons({
  roomId,
  closed,
  startAt,
  endAt,
  participants,
}: {
  roomId: string;
  closed: boolean;
  startAt: string;
  endAt: string;
  participants?: string[];
}) {
  const [msg, setMsg] = useState('');
  const [myUid, setMyUid] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const unsub = onAuthStateChanged(auth, (u) => setMyUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  const now = new Date();
  const isClosed = !!closed;
  const isStarted = now >= new Date(startAt);
  const isEnded = now >= new Date(endAt);
  const amIJoined = useMemo(() => {
    if (!myUid || !Array.isArray(participants)) return false;
    return participants.includes(myUid);
  }, [myUid, participants]);

  const canJoin = useMemo(() => {
    if (isClosed || isEnded) return false;
    if (amIJoined) return false;
    return true;
  }, [isClosed, isEnded, amIJoined]);

  const canLeave = useMemo(() => {
    if (isClosed || isEnded) return false;
    if (!amIJoined) return false;
    // 시작 이후 나가기 금지는 유지(정책)
    if (isStarted) return false;
    return true;
  }, [isClosed, isEnded, amIJoined, isStarted]);

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
