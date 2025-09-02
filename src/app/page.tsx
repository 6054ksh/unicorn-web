'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import HomeNav from '@/components/HomeNav';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, query, where, orderBy, limit, onSnapshot,
  getDocs, documentId
} from 'firebase/firestore';
import { authedFetch } from '@/lib/authedFetch';

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  startAt: string;
  endAt?: string;     // ← 없을 수 있으니 optional
  revealAt?: string;  // ← optional
  participants?: string[];
  participantsCount?: number;
  closed?: boolean;
};

type UserMeta = { uid: string; name?: string; profileImage?: string };

export default function HomePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [users, setUsers] = useState<Record<string, UserMeta>>({});
  const [vote, setVote] = useState({ thumbsForUid: '', heartForUid: '', noshowUid: 'none' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const auth = useMemo(() => getAuth(firebaseApp), []);
  const db = useMemo(() => getFirestore(firebaseApp), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, [auth]);

  // 안전한 종료시각 계산: endAt 없으면 startAt + 5h
  const calcEndDate = (r: Room): Date => {
    const start = new Date(r.startAt);
    if (r.endAt) {
      const e = new Date(r.endAt);
      if (!Number.isNaN(e.getTime())) return e;
    }
    return new Date(start.getTime() + 5 * 60 * 60 * 1000);
  };

  // 내가 참여한 최신 방(진행중/예정/종료+24h) 1개
  useEffect(() => {
    if (!uid) { setRoom(null); setUsers({}); setLoading(false); return; }
    setLoading(true);

    const qy = query(
      collection(db, 'rooms'),
      where('participants', 'array-contains', uid),
      orderBy('startAt', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(qy, (snap) => {
      const now = new Date();
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Room[];

      const picked = rows.find(r => {
        const end = calcEndDate(r);
        const endedWithin1d = now < new Date(end.getTime() + 24 * 60 * 60 * 1000);
        const notClosedYet = !r.closed;
        return notClosedYet || endedWithin1d;
      }) || null;

      setRoom(picked);

      // 참가자 메타 로딩
      (async () => {
        if (picked?.participants?.length) {
          const ids = picked.participants!;
          const chunks: string[][] = [];
          for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
          const map: Record<string, UserMeta> = {};
          for (const g of chunks) {
            const uQ = query(collection(db, 'users'), where(documentId(), 'in', g));
            const uS = await getDocs(uQ);
            uS.forEach(d => {
              const v = d.data() as any;
              map[d.id] = { uid: d.id, name: v?.name || '(이름없음)', profileImage: v?.profileImage || '' };
            });
          }
          setUsers(map);
        } else {
          setUsers({});
        }
        setLoading(false);
      })();
    }, () => setLoading(false));

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, uid]);

  const nowStateLabel = (r: Room | null) => {
    if (!r) return '';
    const now = new Date();
    const start = new Date(r.startAt);
    const end = calcEndDate(r);
    if (r.closed) return '종료';
    if (now >= start && now < end) return '진행중';
    if (now >= end) return '종료';
    return '모집중';
  };

  const isVoteWindow = (r: Room | null) => {
    if (!r) return false;
    const end = calcEndDate(r);
    const now = new Date();
    return now >= end && now < new Date(end.getTime() + 24 * 60 * 60 * 1000);
  };

  const submitVote = async () => {
    if (!room) return;
    setMsg('투표 전송 중…');
    try {
      const res = await authedFetch('/api/rooms/vote', {
        method: 'POST',
        body: JSON.stringify({
          roomId: room.id,
          thumbsForUid: vote.thumbsForUid || null,
          heartForUid: vote.heartForUid || null,
          noshowUid: vote.noshowUid || 'none',
        })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'vote failed');
      setMsg('✅ 투표 완료');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  const human = (iso?: string) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  return (
    <main style={{ padding: 0, background: '#fafafa', minHeight: '100vh' }}>
      <HomeNav />

      {/* Hero */}
      <section
        style={{
          padding: 20,
          borderBottom: '1px solid #eee',
          background: 'linear-gradient(135deg,#eef2ff,#fff7ed)'
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#111' }}>UNIcorn 🦄</h1>
          <p style={{ margin: '6px 0 12px', color: '#444' }}>
            익명·공평·가벼운 만남으로 학생회 네트워킹을 활짝 ✨
          </p>

          {/* 빠른 이동 */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/room" style={btn('#111', '#fff')}>모임 보기</Link>
            <Link href="/room/new" style={btn('#2563eb', '#fff')}>모임 만들기</Link>
            <Link href="/scores" style={btn('#10b981', '#fff')}>점수판</Link>
            <Link href="/feedback" style={btn('#f59e0b', '#fff')}>방명록</Link>
            <Link href="/notifications/enable" style={btn('#9333ea', '#fff')}>알림 설정</Link>
            <Link href="/me" style={btn('#374151', '#fff')}>내 정보</Link>
          </div>
        </div>
      </section>

      {/* 본문 */}
      <section style={{ padding: 20 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 16 }}>
          {/* 내 모임 카드 */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>내 모임</div>
              {room ? (
                <span style={{
                  fontSize: 12, padding: '2px 8px', borderRadius: 999, border: '1px solid #ddd',
                  background:
                    nowStateLabel(room) === '진행중' ? '#e6f4ea' :
                    nowStateLabel(room) === '종료' ? '#f3f4f6' : '#eef2ff',
                  color:
                    nowStateLabel(room) === '진행중' ? '#166534' :
                    nowStateLabel(room) === '종료' ? '#374151' : '#3730a3'
                }}>
                  {nowStateLabel(room)}
                </span>
              ) : null}
            </div>

            {/* 로그인/로딩/내용 */}
            {!uid ? (
              <div style={{ color: '#666', fontSize: 13, marginTop: 6 }}>
                로그인하면 내가 참여한 모임과 투표가 보여요. <a href="/login">로그인하러 가기</a>
              </div>
            ) : loading ? (
              <div style={{ color: '#666', fontSize: 13, marginTop: 6 }}>불러오는 중…</div>
            ) : room ? (
              <>
                <div style={{ marginTop: 6, color: '#333' }}>
                  <a href={`/room/${room.id}`} style={{ textDecoration: 'none', color: '#111', fontWeight: 700 }}>
                    {room.title}
                  </a>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                    장소: {room.location}
                    <br />
                    시간: {human(room.startAt)} ~ {human(calcEndDate(room).toISOString())}
                  </div>

                  {/* 투표 패널: 종료 후 24h 동안 표시 */}
                  {isVoteWindow(room) ? (
                    <div style={{ marginTop: 12, borderTop: '1px dashed #eee', paddingTop: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>모임 투표</div>
                      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span>👍 따봉 줄 사람</span>
                          <select
                            value={vote.thumbsForUid}
                            onChange={e => setVote(v => ({ ...v, thumbsForUid: e.target.value }))}
                          >
                            <option value="">선택 안 함</option>
                            {(room.participants || []).map(u => (
                              <option key={u} value={u}>{users[u]?.name || u}</option>
                            ))}
                          </select>
                        </label>

                        <label style={{ display: 'grid', gap: 4 }}>
                          <span>❤️ 하트 줄 사람</span>
                          <select
                            value={vote.heartForUid}
                            onChange={e => setVote(v => ({ ...v, heartForUid: e.target.value }))}
                          >
                            <option value="">선택 안 함</option>
                            {(room.participants || []).map(u => (
                              <option key={u} value={u}>{users[u]?.name || u}</option>
                            ))}
                          </select>
                        </label>

                        <label style={{ display: 'grid', gap: 4 }}>
                          <span>🚫 노쇼 투표</span>
                          <select
                            value={vote.noshowUid}
                            onChange={e => setVote(v => ({ ...v, noshowUid: e.target.value }))}
                          >
                            <option value="none">노쇼자 없음</option>
                            {(room.participants || []).map(u => (
                              <option key={u} value={u}>{users[u]?.name || u}</option>
                            ))}
                          </select>
                        </label>

                        <div>
                          <button
                            onClick={submitVote}
                            style={{ padding: '8px 12px', borderRadius: 8, background: '#111', color: '#fff' }}
                          >
                            투표하기
                          </button>
                          <span style={{ marginLeft: 8, color: msg.startsWith('❌') ? 'crimson' : '#2e7d32' }}>{msg}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div style={{ color: '#666', fontSize: 13 }}>참여 중이거나 최근(24시간 내) 종료된 모임이 없습니다.</div>
            )}
          </div>

          {/* 기능 소개 카드 (밝은 톤) */}
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <InfoCard
              title="익명 매칭"
              text="모임 1시간 전까지 구성원이 익명으로 유지돼요. 누구나 공평하게 주도!"
            />
            <InfoCard
              title="점수 & 칭호"
              text="참여/개설/정원보너스/연속참여/칭호… 연말 포상까지 달려보자!"
            />
            <InfoCard
              title="오픈채팅 연결"
              text="모임 시작 1시간 전 구성원 공개와 함께 카카오 오픈채팅으로 연결!"
            />
          </div>

          {/* 빠른 이동 (보조) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            <a href="/room" style={quickCard}>모임 목록 보기</a>
            <a href="/room/new" style={quickCard}>모임 만들기</a>
            <a href="/scores" style={quickCard}>점수판</a>
            <a href="/notifications/enable" style={quickCard}>알림 설정</a>
            <a href="/feedback" style={quickCard}>방명록</a>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---------- 스타일 헬퍼 ---------- */
function btn(bg: string, fg: string): React.CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 10,
    background: bg,
    color: fg,
    textDecoration: 'none',
    border: '1px solid ' + (bg === '#111' ? '#111' : 'transparent')
  };
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ border: '1px solid #e6e8eb', borderRadius: 12, padding: 12, background: '#fff' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: '#555' }}>{text}</div>
    </div>
  );
}

const quickCard: React.CSSProperties = {
  display: 'block',
  padding: 14,
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  background: '#fff',
  textDecoration: 'none',
  color: '#111',
  fontWeight: 700
};
