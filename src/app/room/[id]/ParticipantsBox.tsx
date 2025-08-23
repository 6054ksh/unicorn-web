// src/app/room/[id]/ParticipantsBox.tsx
'use client';

import { useEffect, useState } from 'react';

type P = { uid: string; name: string; profileImage?: string };
export default function ParticipantsBox({ roomId, capacity }: { roomId: string; capacity?: number }) {
  const [loading, setLoading] = useState(true);
  const [notYet, setNotYet] = useState<{ revealAt?: string } | null>(null);
  const [list, setList] = useState<P[]>([]);
  const [err, setErr] = useState('');

  const fetchOnce = async () => {
    setErr('');
    try {
      const res = await fetch(`/api/rooms/participants?roomId=${encodeURIComponent(roomId)}`, { cache: 'no-store' });
      const j = await res.json();
      if (res.status === 403 && j?.notRevealed) {
        setNotYet({ revealAt: j.revealAt });
        setList([]);
      } else if (!res.ok) {
        throw new Error(j?.error || 'load failed');
      } else {
        setNotYet(null);
        setList(j.participants || []);
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnce();                          // 최초 1회
    const t = setInterval(fetchOnce, 20000); // 20초마다 갱신
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ margin: '8px 0' }}>참여자</h3>
      {loading && <p>불러오는 중…</p>}
      {err && <p style={{ color: 'crimson' }}>❌ {err}</p>}
      {notYet && (
        <p style={{ color: '#555' }}>
          참여자 공개는 모임 <b>1시간 전</b>부터 확인 가능합니다.
          {notYet.revealAt ? <> (공개 시각: {new Date(notYet.revealAt).toLocaleString()})</> : null}
        </p>
      )}
      {!notYet && !loading && (
        <>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {list.map((p) => (
              <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #eee', borderRadius: 8, padding: 8 }}>
                {p.profileImage ? (
                  <img src={p.profileImage} alt={p.name} style={{ width: 28, height: 28, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f1f2f4',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>?</div>
                )}
                <span>{p.name}</span>
              </div>
            ))}
            {!list.length && <div style={{ color: '#777' }}>아직 참여자가 없습니다.</div>}
          </div>
          <p style={{ marginTop: 8, color: '#666' }}>참여 {list.length}명{typeof capacity === 'number' ? ` / 정원 ${capacity}명` : ''}</p>
        </>
      )}
    </section>
  );
}
