'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  votingOpen?: boolean;
  participants?: string[];
  participantsCount?: number;
  kakaoOpenChatUrl?: string;
  type?: string;
  content?: string;
};

function fmt(iso?: string) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

// ✅ name → displayName 로 변경 (DOM 전역 name 충돌 회피)
type UserLite = { uid: string; displayName?: string };

export default function Client({ room }: { room: Room }) {
  const [uid, setUid] = useState<string | null>(null);
  const [joined, setJoined] = useState<boolean>(false);
  const [msg, setMsg] = useState('');
  const [voted, setVoted] = useState<boolean>(false);

  const [participants, setParticipants] = useState<UserLite[]>([]);
  const [thumbsForUid, setThumbsForUid] = useState<string>('');
  const [heartForUid, setHeartForUid] = useState<string>('');
  const [noshowUid, setNoshowUid] = useState<'none' | string>('none');
  const [submitting, setSubmitting] = useState(false);

  // 내 UID
  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  // 내가 참여했는지
  useEffect(() => {
    const list = Array.isArray(room.participants) ? room.participants : [];
    setJoined(uid ? list.includes(uid) : false);
  }, [uid, room.participants]);

  const now = new Date();
  const endAt = new Date(room.endAt);
  const isEnded = now >= endAt;
  const within24hAfterEnd = now.getTime() <= endAt.getTime() + 24 * 60 * 60 * 1000;

  // 상세 진입 시: 상태 보정(최소인원 미달/투표중 전환) — 1회
  const ensuredRef = useRef(false);
  useEffect(() => {
    (async () => {
      if (ensuredRef.current) return;
      ensuredRef.current = true;
      try {
        await authedFetch('/api/rooms/ensure', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ roomId: room.id }),
        });
      } catch {}
    })();
  }, [room.id]);

  // 투표 여부 + 참여자 표시명 가져오기
  useEffect(() => {
    (async () => {
      if (!uid) return;
      // 이미 투표했는지
      try {
        const r1 = await authedFetch(`/api/rooms/vote-status?roomId=${room.id}`);
        if (r1.ok) {
          const j = await r1.json();
          setVoted(!!j?.voted);
        }
      } catch {}

      // 참여자 표시 이름
      const uids: string[] = Array.isArray(room.participants) ? room.participants : [];
      const arr: UserLite[] = [];
      for (const u of uids) {
        try {
          const ur = await authedFetch(`/api/users/get?uid=${encodeURIComponent(u)}`);
          if (ur.ok) {
            const d = await ur.json();
            // ✅ displayName 사용
            arr.push({ uid: u, displayName: d?.name || d?.displayName || undefined });
          } else {
            arr.push({ uid: u });
          }
        } catch {
          arr.push({ uid: u });
        }
      }
      setParticipants(arr);
    })();
  }, [uid, room.id, room.participants]);

  const full = (room.capacity || 0) > 0 &&
    (room.participantsCount || (room.participants?.length || 0)) >= room.capacity;

  const canJoin = useMemo(() => {
    if (room.closed || isEnded) return false;
    if (joined) return false;
    if (full) return false;
    return true;
  }, [room.closed, isEnded, joined, full]);

  const canLeave = useMemo(() => {
    if (room.closed || isEnded) return false;
    if (!joined) return false;
    // 시작 후 나가기 금지
    if (now >= new Date(room.startAt)) return false;
    return true;
  }, [room.closed, isEnded, joined, room.startAt]);

  const join = async () => {
    setMsg('참여 중…');
    try {
      const res = await authedFetch('/api/rooms/join', { method: 'POST', body: JSON.stringify({ roomId: room.id }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'join failed');
      setMsg('✅ 참여 완료');
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
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  // 투표 노출 조건
  const shouldShowVote = joined && !voted && (room.votingOpen || (isEnded && within24hAfterEnd));

  const submitVote = async () => {
    try {
      setSubmitting(true);
      const res = await authedFetch('/api/rooms/vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          thumbsForUid: thumbsForUid || null,
          heartForUid: heartForUid || null,
          noshowUid,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || '투표 실패');
      setVoted(true);
      setMsg('🗳️ 투표가 저장되었어요. 감사합니다!');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    } finally {
      setSubmitting(false);
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
          {(room.votingOpen || (isEnded && within24hAfterEnd)) &&
            <div style={{ marginTop: 6, fontSize: 12, color: '#92400e' }}>상태: 투표중</div>}
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={join}
            disabled={!canJoin}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd',
              background: canJoin ? '#111' : '#e5e7eb',
              color: canJoin ? '#fff' : '#999',
              cursor: canJoin ? 'pointer' : 'not-allowed'
            }}
            title={joined ? '이미 참여했습니다' : full ? '정원 초과' : isEnded ? '종료됨' : room.closed ? '닫힘' : '참여하기'}
          >
            참여하기
          </button>
          <button
            onClick={leave}
            disabled={!canLeave}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd',
              background: canLeave ? '#fff' : '#f3f4f6',
              color: canLeave ? '#111' : '#999',
              cursor: canLeave ? 'pointer' : 'not-allowed'
            }}
            title={!joined ? '참여하지 않았습니다' : isEnded ? '종료됨' : room.closed ? '닫힘' : '나가기'}
          >
            나가기
          </button>
        </div>
      </header>

      {(room.type || room.content || room.kakaoOpenChatUrl) && (
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
      )}

      {/* 투표 박스 */}
      {shouldShowVote && (
        <section style={{ border:'1px dashed #f59e0b', borderRadius: 12, padding: 12, background:'#fffbeb' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>🗳️ 이 모임에 투표하기</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ fontSize: 12 }}>👍 칭찬하고 싶은 사람</label>
            <select
              value={thumbsForUid}
              onChange={e => setThumbsForUid(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }}
            >
              <option value="">선택 안 함</option>
              {participants.map(p => (<option key={p.uid} value={p.uid}>{p.displayName || p.uid}</option>))}
            </select>

            <label style={{ fontSize: 12 }}>❤️ 고마운 사람</label>
            <select
              value={heartForUid}
              onChange={e => setHeartForUid(e.target.value)}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }}
            >
              <option value="">선택 안 함</option>
              {participants.map(p => (<option key={p.uid} value={p.uid}>{p.displayName || p.uid}</option>))}
            </select>

            <label style={{ fontSize: 12 }}>🚫 노쇼</label>
            <select
              value={noshowUid}
              onChange={e => setNoshowUid((e.target.value as any) || 'none')}
              style={{ padding: 8, borderRadius: 8, border: '1px solid #e5e7eb' }}
            >
              <option value="none">없음</option>
              {participants.map(p => (<option key={p.uid} value={p.uid}>{p.displayName || p.uid}</option>))}
            </select>

            <button
              onClick={submitVote}
              disabled={submitting}
              style={{ padding: '8px 12px', borderRadius: 8, background: '#111', color: '#fff', border: '1px solid #111' }}
            >
              {submitting ? '제출 중…' : '제출'}
            </button>
          </div>
        </section>
      )}

      {msg && <p style={{ color: msg.startsWith('❌') ? 'crimson' : '#111' }}>{msg}</p>}
    </div>
  );
}
