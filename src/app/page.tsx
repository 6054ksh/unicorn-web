'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit as fsLimit,
  onSnapshot,
  getDocs,
  documentId,
} from 'firebase/firestore';
import { authedFetch } from '@/lib/authedFetch';

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  startAt: string;
  endAt: string;
  revealAt: string;
  participants?: string[];
  participantsCount?: number;
  closed?: boolean;
};

type UserMeta = { uid: string; name?: string; profileImage?: string };

export default function HomePage() {
  // ---- 상태 ----
  const [uid, setUid] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [users, setUsers] = useState<Record<string, UserMeta>>({});
  const [vote, setVote] = useState({ thumbsForUid: '', heartForUid: '', noshowUid: 'none' });
  const [msg, setMsg] = useState('');

  const auth = useMemo(() => getAuth(firebaseApp), []);
  const db = useMemo(() => getFirestore(firebaseApp), []);

  // ---- 로그인 감지 ----
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, [auth]);

  // ---- 내가 참여한 최신 방(모집중/진행중/종료+24h) 1개 구독 ----
  useEffect(() => {
    if (!uid) {
      setRoom(null);
      setUsers({});
      return;
    }
    const qy = query(
      collection(db, 'rooms'),
      where('participants', 'array-contains', uid),
      orderBy('startAt', 'desc'),
      fsLimit(10)
    );
    const unsub = onSnapshot(qy, async (snap) => {
      const now = Date.now();
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Room[];

      // 진행중/모집중 || 종료 + 24시간 내 하나 고르기
      const picked =
        rows.find((r) => !r.closed) ||
        rows.find((r) => {
          const end = new Date(r.endAt).getTime();
          return now < end + 24 * 60 * 60 * 1000; // 종료 후 24h
        }) ||
        null;

      setRoom(picked);

      // 참가자 이름/이미지 매핑
      if (picked?.participants?.length) {
        const ids = picked.participants!;
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
        const map: Record<string, UserMeta> = {};
        for (const g of chunks) {
          const uQ = query(collection(db, 'users'), where(documentId(), 'in', g));
          const uS = await getDocs(uQ);
          uS.forEach((d) => {
            const v = d.data() as any;
            map[d.id] = {
              uid: d.id,
              name: v?.name || '(이름없음)',
              profileImage: v?.profileImage || '',
            };
          });
        }
        setUsers(map);
      } else {
        setUsers({});
      }
    });
    return () => unsub();
  }, [db, uid]);

  // ---- 라벨 계산 ----
  const stateLabel = (r: Room | null) => {
    if (!r) return '';
    const now = Date.now();
    if (r.closed) return '종료';
    if (now >= new Date(r.startAt).getTime()) return '진행중';
    return '모집중';
  };

  const within24hAfterEnd =
    room &&
    new Date().getTime() >= new Date(room.endAt).getTime() &&
    new Date().getTime() < new Date(room.endAt).getTime() + 24 * 60 * 60 * 1000;

  // ---- 투표 ----
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
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'vote failed');
      setMsg('✅ 투표 완료');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  // ---- 스타일 헬퍼 ----
  const pill = (bg: string, color: string) => ({
    display: 'inline-block',
    padding: '4px 10px',
    fontSize: 12,
    borderRadius: 999,
    background: bg,
    color,
    border: '1px solid rgba(0,0,0,0.06)',
  });

  return (
    <main style={{ padding: 0, background: '#FAFAFD', minHeight: '100vh' }}>
      {/* 상단 검은 네비 제거 → 밝은 히어로 섹션만 */}
      <section
        style={{
          padding: '28px 20px',
          background:
            'linear-gradient(135deg, rgba(255,226,255,0.7) 0%, rgba(220,235,255,0.6) 50%, rgba(220,255,236,0.6) 100%)',
          borderBottom: '1px solid #eceef3',
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={pill('#fff', '#7c3aed') as React.CSSProperties}>UNI 학생회</span>
            <span style={pill('#fff', '#0ea5e9') as React.CSSProperties}>서로 더 친해지기</span>
          </div>
          <h1 style={{ margin: '10px 0 6px', fontSize: 28, fontWeight: 900, letterSpacing: -0.2 }}>UNIcorn 🦄</h1>
          <p style={{ margin: 0, color: '#555', fontSize: 14 }}>
            익명 매칭으로 가볍게 열고, 쉽게 참여해요. 오늘도 한 걸음 더 친해지기!
          </p>
        </div>
      </section>

      {/* 메인 컨텐츠 */}
      <section style={{ padding: 20 }}>
        <div style={{ display: 'grid', gap: 16, maxWidth: 960, margin: '0 auto' }}>
          {/* 내 모임 카드 */}
          <div style={{ border: '1px solid #e8eaf0', borderRadius: 14, background: '#fff', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>내 모임</span>
                {room ? (
                  <span
                    style={
                      stateLabel(room) === '진행중'
                        ? (pill('#e6f4ea', '#166534') as React.CSSProperties)
                        : stateLabel(room) === '종료'
                        ? (pill('#f3f4f6', '#374151') as React.CSSProperties)
                        : (pill('#eef2ff', '#3730a3') as React.CSSProperties)
                    }
                  >
                    {stateLabel(room)}
                  </span>
                ) : null}
              </div>
              {uid ? (
                <Link href="/room" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>
                  전체 모임 보기 →
                </Link>
              ) : null}
            </div>

            {uid ? (
              room ? (
                <div style={{ marginTop: 8 }}>
                  <a
                    href={`/room/${room.id}`}
                    style={{ textDecoration: 'none', color: '#111', fontWeight: 800, fontSize: 16 }}
                  >
                    {room.title}
                  </a>
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                    장소: {room.location} · 시간:{' '}
                    {new Date(room.startAt).toLocaleString()} ~ {new Date(room.endAt).toLocaleString()}
                  </div>

                  {/* 종료 후 24시간 동안 투표 패널 */}
                  {within24hAfterEnd ? (
                    <div style={{ marginTop: 12, borderTop: '1px dashed #eee', paddingTop: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>모임 투표</div>
                      <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span>👍 따봉 줄 사람</span>
                          <select
                            value={vote.thumbsForUid}
                            onChange={(e) => setVote((v) => ({ ...v, thumbsForUid: e.target.value }))}
                          >
                            <option value="">선택 안 함</option>
                            {(room.participants || []).map((u) => (
                              <option key={u} value={u}>
                                {users[u]?.name || u}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label style={{ display: 'grid', gap: 4 }}>
                          <span>❤️ 하트 줄 사람</span>
                          <select
                            value={vote.heartForUid}
                            onChange={(e) => setVote((v) => ({ ...v, heartForUid: e.target.value }))}
                          >
                            <option value="">선택 안 함</option>
                            {(room.participants || []).map((u) => (
                              <option key={u} value={u}>
                                {users[u]?.name || u}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label style={{ display: 'grid', gap: 4 }}>
                          <span>🚫 노쇼 투표</span>
                          <select
                            value={vote.noshowUid}
                            onChange={(e) => setVote((v) => ({ ...v, noshowUid: e.target.value }))}
                          >
                            <option value="none">노쇼자 없음</option>
                            {(room.participants || []).map((u) => (
                              <option key={u} value={u}>
                                {users[u]?.name || u}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div>
                          <button
                            onClick={submitVote}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: '#111',
                              color: '#fff',
                              border: '1px solid #111',
                            }}
                          >
                            투표하기
                          </button>
                          <span style={{ marginLeft: 8, color: msg.startsWith('❌') ? 'crimson' : '#333' }}>{msg}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                  참여 중이거나 최근(24시간 내) 종료된 모임이 없습니다.
                </div>
              )
            ) : (
              <div style={{ color: '#666', fontSize: 13 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>로그인이 필요합니다</div>
                <p style={{ margin: 0 }}>
                  <a href="/login" style={{ color: '#2563eb' }}>
                    로그인
                  </a>{' '}
                  후 내 모임과 투표를 이용하세요.
                </p>
              </div>
            )}
          </div>

          {/* 빠른 이동 (중복 버튼 정리: 심플하게 4개만) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
              gap: 10,
            }}
          >
            <a href="/room" className="cardLink" style={card}>
              모임 목록 보기
            </a>
            <a href="/room/new" className="cardLink" style={card}>
              모임 만들기
            </a>
            <a href="/scores" className="cardLink" style={card}>
              점수판
            </a>
            <a href="/notifications/enable" className="cardLink" style={card}>
              알림 설정
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  display: 'block',
  padding: 14,
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  background: '#fff',
  textDecoration: 'none',
  color: '#111',
  fontWeight: 700,
};
