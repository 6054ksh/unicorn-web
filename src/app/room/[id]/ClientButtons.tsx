'use client';

import { useEffect, useMemo, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

export default function ClientButtons({
  roomId, startAt, endAt, closed
}:{
  roomId: string; startAt: string; endAt: string; closed: boolean;
}) {
  const [joined, setJoined] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');

  const now = new Date();
  const started = now >= new Date(startAt);
  const ended   = now >= new Date(endAt);

  const canJoin = useMemo(() => {
    if (closed || ended) return false;
    if (joined === true) return false;
    return true;
  }, [closed, ended, joined]);

  const canLeave = useMemo(() => {
    if (closed || ended) return false;
    if (started) return false;
    if (joined !== true) return false;
    return true;
  }, [closed, ended, started, joined]);

  const refreshJoined = async () => {
    try {
      const res = await authedFetch(`/api/rooms/am-i-in?roomId=${encodeURIComponent(roomId)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'failed');
      setJoined(!!j.joined);
    } catch {
      setJoined(false);
    }
  };

  useEffect(() => { refreshJoined(); /* eslint-disable-next-line */ }, [roomId]);

  const join = async () => {
    setMsg('참여 중…');
    try {
      const res = await authedFetch('/api/rooms/join', { method:'POST', body: JSON.stringify({ roomId }) });
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
      const res = await authedFetch('/api/rooms/leave', { method:'POST', body: JSON.stringify({ roomId }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'leave failed');
      setMsg('✅ 나가기 완료');
      setJoined(false);
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
      <button onClick={join} disabled={!canJoin} style={{
        padding:'8px 12px', borderRadius:10, border:'1px solid #ddd',
        background: canJoin ? '#111' : '#e5e7eb', color: canJoin ? '#fff' : '#999'
      }}>참여하기</button>

      <button onClick={leave} disabled={!canLeave} style={{
        padding:'8px 12px', borderRadius:10, border:'1px solid #ddd',
        background: canLeave ? '#fff' : '#e5e7eb', color: canLeave ? '#111' : '#999'
      }}>나가기</button>

      <span style={{ color: msg.startsWith('❌') ? 'crimson' : '#333' }}>{msg}</span>
    </div>
  );
}
