'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
// ✅ 종(알림) UI 추가
import NotificationBell from '@/components/NotifyBell';

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
  const [uid, setUid] = useState<string | null>(null);
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<Record<string, UserMeta>>({});
  const [voteMap, setVoteMap] = useState<Record<string, { thumbsForUid: string; heartForUid: string; noshowUid: string }>>({});
  const [msg, setMsg] = useState('');

  const auth = useMemo(() => getAuth(firebaseApp), []);
  const db = useMemo(() => getFirestore(firebaseApp), []);
  const unsubRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, [auth]);

  // 내가 참여한 방들(모집중/진행중 + 종료 24h) 여러 개
  useEffect(() => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    setMyRooms([]);
    setUsers({});
    if (!uid) return;

    const col = collection(db, 'rooms');

    const handler = async (snap: any) => {
      const now = Date.now();
      const rows = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Room[];

      const list = rows.filter((r) => {
        if (!r) return false;
        if (!r.closed) return true; // 모집중/진행중
        const end = new Date(r.endAt).getTime();
        return now < end + 24 * 60 * 60 * 1000; // 종료 +24h
      });

      // 최신순
      list.sort((a, b) => String(b.startAt).localeCompare(String(a.startAt)));
      setMyRooms(list);

      // 참가자 이름/이미지(최대 120명 정도까지 안전)
      const ids = Array.from(new Set(list.flatMap((r) => r.participants || [])));
      if (ids.length) {
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
        const map: Record<string, UserMeta> = {};
        for (const g of chunks) {
          const uQ = query(collection(db, 'users'), where(documentId(), 'in', g));
          const uS = await getDocs(uQ);
          uS.forEach((d) => {
            const v = d.data() as any;
            map[d.id] = { uid: d.id, name: v?.name || '(이름없음)', profileImage: v?.profileImage || '' };
          });
        }
        setUsers(map);
      } else {
        setUsers({});
      }
    };

    const tryPrimary = () => {
      try {
        const q1 = query(col, where('participants', 'array-contains', uid), orderBy('startAt', 'desc'), fsLimit(20));
        const unsub = onSnapshot(q1, handler, () => tryFallback());
        unsubRef.current = unsub;
      } catch {
        tryFallback();
      }
    };

    const tryFallback = () => {
      const q2 = query(col, where('participants', 'array-contains', uid), fsLimit(20));
      const unsub = onSnapshot(q2, handler);
      unsubRef.current = unsub;
    };

    tryPrimary();
    return () => { if (unsubRef.current) unsubRef.current(); unsubRef.current = null; };
  }, [db, uid]);

  const stateLabel = (r: Room) => {
    const now = Date.now();
    if (r.closed) return '종료';
    if (now >= new Date(r.startAt).getTime()) return '진행중';
    return '모집중';
  };

  const within24hAfterEnd = (r: Room) => {
    const now = Date.now();
    const end = new Date(r.endAt).getTime();
    return now >= end && now < end + 24 * 60 * 60 * 1000;
  };

  const submitVote = async (roomId: string) => {
    const v = voteMap[roomId] || { thumbsForUid: '', heartForUid: '', noshowUid: 'none' };
    setMsg('투표 전송 중…');
    try {
      const res = await authedFetch('/api/rooms/vote', {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          thumbsForUid: v.thumbsForUid || null,
          heartForUid: v.heartForUid || null,
          noshowUid: v.noshowUid || 'none',
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'vote failed');
      setMsg('✅ 투표 완료');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  // 스타일
  const pill = (bg: string, color: string) => ({
    display: 'inline-block',
    padding: '4px 10px',
    fontSize: 12,
    borderRadius: 999,
    background: bg,
    color,
    border: '1px solid rgba(0,0,0,0.06)',
  });

  const smallCard = (bg: string, fg: string): React.CSSProperties => ({
    display: 'block',
    padding: 14,
    borderRadius: 14,
    textDecoration: 'none',
    background: bg,
    color: fg,
    fontWeight: 800,
    border: '1px solid rgba(0,0,0,.06)',
    boxShadow: '0 4px 10px rgba(0,0,0,.06)',
    textAlign: 'center',
    fontSize: 14,
  });

  return (
    <main style={{ padding: 0, background: '#FAFAFD', minHeight: '100vh' }}>
      {/* 상단 히어로 */}
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
            <span style={pill('#fff', '#0ea5e9') as React.CSSProperties}>익명 매칭</span>
          </div>
          <h1 style={{ margin: '10px 0 6px', fontSize: 28, fontWeight: 900, letterSpacing: -0.2 }}>UNIcorn 🦄</h1>
          <p style={{ margin: 0, color: '#555', fontSize: 14 }}>가볍게 열고, 쉽게 참여해서 더 친해지기!</p>

          {/* ✅ 우측 상단 홈 버튼 + 그 아래 종(알림) 카드 */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link
                href="/"
                style={{
                  textDecoration: 'none',
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid #e5e7eb',
                  background: '#ffffffaa',
                  backdropFilter: 'blur(4px)',
                  fontWeight: 700,
                  color: '#111'
                }}
              >
                홈
              </Link>
            </div>
            <div
              style={{
                marginTop: 8,
                border: '1px solid #e8eaf0',
                borderRadius: 12,
                background: '#fff',
                padding: '8px 12px',
              }}
            >
              <NotificationBell />
            </div>
          </div>
        </div>
      </section>

      {/* 콘텐츠 */}
      <section style={{ padding: 20 }}>
        <div style={{ display: 'grid', gap: 16, maxWidth: 960, margin: '0 auto' }}>
          {/* 내 모임들 */}
          <div style={{ border: '1px solid #e8eaf0', borderRadius: 14, background: '#fff', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>내 모임</div>
              {uid ? <Link href="/room" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>전체 모임 →</Link> : null}
            </div>

            {uid ? (
              myRooms.length ? (
                <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                  {myRooms.map((r) => (
                    <div key={r.id} style={{ border: '1px solid #f0f1f5', borderRadius: 12, padding: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <a href={`/room/${r.id}`} style={{ textDecoration: 'none', color: '#111', fontWeight: 800 }}>
                          {r.title}
                        </a>
                        <span
                          style={
                            stateLabel(r) === '진행중'
                              ? (pill('#e6f4ea', '#166534') as React.CSSProperties)
                              : stateLabel(r) === '종료'
                              ? (pill('#f3f4f6', '#374151') as React.CSSProperties)
                              : (pill('#eef2ff', '#3730a3') as React.CSSProperties)
                          }
                        >
                          {stateLabel(r)}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                        장소: {r.location} · 시간: {new Date(r.startAt).toLocaleString()} ~ {new Date(r.endAt).toLocaleString()}
                      </div>

                      {/* 종료 후 24h 투표 */}
                      {within24hAfterEnd(r) ? (
                        <div style={{ marginTop: 10, borderTop: '1px dashed #eee', paddingTop: 10 }}>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>모임 투표</div>

                          <div style={{ display: 'grid', gap: 8, maxWidth: 520 }}>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <span>👍 따봉 줄 사람</span>
                              <select
                                value={voteMap[r.id]?.thumbsForUid || ''}
                                onChange={(e) =>
                                  setVoteMap((s) => ({ ...s, [r.id]: { ...(s[r.id] || { heartForUid: '', noshowUid: 'none' }), thumbsForUid: e.target.value } }))
                                }
                              >
                                <option value="">선택 안 함</option>
                                {(r.participants || []).map((u) => (
                                  <option key={u} value={u}>{users[u]?.name || u}</option>
                                ))}
                              </select>
                            </label>

                            <label style={{ display: 'grid', gap: 4 }}>
                              <span>❤️ 하트 줄 사람</span>
                              <select
                                value={voteMap[r.id]?.heartForUid || ''}
                                onChange={(e) =>
                                  setVoteMap((s) => ({ ...s, [r.id]: { ...(s[r.id] || { thumbsForUid: '', noshowUid: 'none' }), heartForUid: e.target.value } }))
                                }
                              >
                                <option value="">선택 안 함</option>
                                {(r.participants || []).map((u) => (
                                  <option key={u} value={u}>{users[u]?.name || u}</option>
                                ))}
                              </select>
                            </label>

                            <label style={{ display: 'grid', gap: 4 }}>
                              <span>🚫 노쇼 투표</span>
                              <select
                                value={voteMap[r.id]?.noshowUid || 'none'}
                                onChange={(e) =>
                                  setVoteMap((s) => ({ ...s, [r.id]: { ...(s[r.id] || { thumbsForUid: '', heartForUid: '' }), noshowUid: e.target.value } }))
                                }
                              >
                                <option value="none">노쇼자 없음</option>
                                {(r.participants || []).map((u) => (
                                  <option key={u} value={u}>{users[u]?.name || u}</option>
                                ))}
                              </select>
                            </label>

                            <div>
                              <button
                                onClick={() => submitVote(r.id)}
                                style={{ padding: '8px 12px', borderRadius: 8, background: '#111', color: '#fff', border: '1px solid #111' }}
                              >
                                투표하기
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>참여 중이거나 최근(24시간 내) 종료된 모임이 없습니다.</div>
              )
            ) : (
              <div style={{ color: '#666', fontSize: 13 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>로그인이 필요합니다</div>
                <p style={{ margin: 0 }}>
                  <a href="/login" style={{ color: '#2563eb' }}>로그인</a> 후 내 모임과 투표를 이용하세요.
                </p>
              </div>
            )}
          </div>

          {/* 알록달록 작은 이동 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {!uid ? (
              <a href="/login" style={smallCard('#FDF2F8', '#BE185D')}>로그인하기</a>
            ) : (
              <a href="/me" style={smallCard('#FDF2F8', '#BE185D')}>내 상태</a>
            )}
            <a href="/room" style={smallCard('#ECFEFF', '#155E75')}>모임 목록</a>
            <a href="/room/new" style={smallCard('#EEF2FF', '#3730A3')}>모임 만들기</a>
            <a href="/scores" style={smallCard('#E6FFFB', '#0F766E')}>점수판</a>
            <a href="/notifications/enable" style={smallCard('#FFF7ED', '#9A3412')}>알림 설정</a>
            <a href="/feedback" style={smallCard('#FFF1F2', '#9D174D')}>방명록</a>
          </div>

          <p style={{ marginTop: 12, color: msg.startsWith('❌') ? 'crimson' : '#333' }}>{msg}</p>
        </div>
      </section>
    </main>
  );
}
