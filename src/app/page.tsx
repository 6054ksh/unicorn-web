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
  getDocs,
  documentId,
} from 'firebase/firestore';
import { authedFetch } from '@/lib/authedFetch';

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  startAt?: string;
  endAt?: string;
  revealAt?: string;
  participants?: string[];
  participantsCount?: number;
  closed?: boolean;
};

type UserMeta = { uid: string; name?: string; profileImage?: string };

export default function HomePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<Record<string, UserMeta>>({});
  const [loading, setLoading] = useState(true);

  const auth = useMemo(() => getAuth(firebaseApp), []);
  const db = useMemo(() => getFirestore(firebaseApp), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, [auth]);

  // 안전한 날짜 포맷터
  const human = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    try {
      return d.toLocaleString();
    } catch {
      return '-';
    }
  };

  const safeMs = (iso?: string) => {
    if (!iso) return NaN;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? NaN : d.getTime();
  };

  // ✅ 내가 참여한 방: 서버에서 id 목록 → rooms 문서 in 쿼리로 읽기
  useEffect(() => {
    let aborted = false;
    (async () => {
      setLoading(true);
      setMyRooms([]);
      setUsers({});
      try {
        if (!uid) { setLoading(false); return; }

        // 1) 내 방 id 목록
        const res = await authedFetch('/api/rooms/my-ids');
        const j = await res.json();
        const ids: string[] = Array.isArray(j?.ids) ? j.ids : [];
        if (!ids.length) { setLoading(false); return; }

        // 2) id들로 rooms 불러오기 (10개씩)
        const all: Room[] = [];
        for (let i = 0; i < ids.length; i += 10) {
          const chunk = ids.slice(i, i + 10);
          const q = query(collection(db, 'rooms'), where(documentId(), 'in', chunk));
          const snap = await getDocs(q);
          snap.forEach((d) => all.push({ id: d.id, ...(d.data() as any) }));
        }

        // 3) 필터: 진행/모집중 + (종료는 24h 이내만)
        const now = Date.now();
        const filtered = all.filter((r) => {
          if (!r) return false;
          if (!r.closed) return true;
          const end = safeMs(r.endAt);
          return Number.isFinite(end) && now < end + 24 * 60 * 60 * 1000;
        });

        // 4) 최신 시작시간 순
        filtered.sort((a, b) => {
          const ta = safeMs(a.startAt) || 0;
          const tb = safeMs(b.startAt) || 0;
          return tb - ta;
        });

        if (aborted) return;
        setMyRooms(filtered);

        // 5) 참여자 프로필 (최대 120명 정도까지)
        const uids = Array.from(new Set(filtered.flatMap((r) => r.participants || [])));
        if (uids.length) {
          const map: Record<string, UserMeta> = {};
          for (let i = 0; i < uids.length; i += 10) {
            const chunk = uids.slice(i, i + 10);
            const uq = query(collection(db, 'users'), where(documentId(), 'in', chunk));
            const us = await getDocs(uq);
            us.forEach((d) => {
              const v = d.data() as any;
              map[d.id] = { uid: d.id, name: v?.name || '(이름없음)', profileImage: v?.profileImage || '' };
            });
          }
          if (!aborted) setUsers(map);
        } else {
          setUsers({});
        }
      } catch {
        // noop
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [db, uid]);

  const stateLabel = (r: Room) => {
    const now = Date.now();
    if (r.closed) return '종료';
    const start = safeMs(r.startAt);
    if (Number.isFinite(start) && now >= start) return '진행중';
    return '모집중';
  };

  // 스타일 유틸
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
              loading ? (
                <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>불러오는 중…</div>
              ) : myRooms.length ? (
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
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
                        장소: {r.location} · 시간: {human(r.startAt)} ~ {human(r.endAt)}
                      </div>
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
        </div>
      </section>
    </main>
  );
}
