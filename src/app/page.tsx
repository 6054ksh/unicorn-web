// src/app/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  startAt: string | null;
  endAt: string | null;
  closed?: boolean;
  participantsCount?: number;
  type?: string;
  content?: string;
};

const LIST_URL = '/api/rooms/list?status=open&limit=6';

export default function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(LIST_URL, { cache: 'no-store' });
        const j = await res.json();
        if (res.ok) setRooms(j.rooms || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return rooms
      .filter(r => !r.closed && r.startAt && new Date(r.startAt).getTime() >= now)
      .sort((a,b) => new Date(a.startAt||0).getTime() - new Date(b.startAt||0).getTime())
      .slice(0, 3);
  }, [rooms]);

  const human = (iso?: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d as any)) return iso;
    return d.toLocaleString();
  };

  return (
    <div>
      {/* Hero */}
      <section style={{
        background:'linear-gradient(180deg,#f8fafc 0%, #fff 100%)',
        borderBottom:'1px solid #eee', padding:'32px 16px'
      }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gap:16, gridTemplateColumns:'1.2fr 1fr', alignItems:'center' }}>
          <div>
            <h1 style={{ margin:'0 0 10px', fontSize:28 }}>UNIcorn 학생회 모임앱</h1>
            <p style={{ margin:'0 0 16px', color:'#555' }}>
              누구나 익명으로 모임을 만들고 참여해요. 시작 1시간 전까지 구성원은 비공개!
            </p>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <Link href="/room/new" style={btnPrimary}>방 만들기</Link>
              <Link href="/room" style={btnSecondary}>모임목록 보기</Link>
              <Link href="/scores" style={btnSecondary}>점수판</Link>
              <Link href="/notifications/enable" style={btnGhost}>알림 설정</Link>
            </div>
          </div>
          <div style={heroCard}>
            <div style={{ fontWeight:700, marginBottom:8 }}>빠른 시작</div>
            <ol style={{ margin:0, paddingLeft:18, color:'#444', lineHeight:1.8 }}>
              <li>카카오로 로그인</li>
              <li>모임 만들기 또는 참여하기</li>
              <li>모임 1시간 전 자동 공개 → 카톡방으로 모이기</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Upcoming */}
      <section style={{ padding:'20px 16px' }}>
        <h2 style={{ margin:'8px 0 12px' }}>다가오는 모임</h2>
        {loading && <p>불러오는 중…</p>}
        {!loading && upcoming.length === 0 && <p>예정된 모임이 없습니다. <Link href="/room">모임목록</Link>에서 찾아보세요.</p>}
        <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {upcoming.map(r => (
            <div key={r.id} style={card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                <Link href={`/room/${r.id}`} style={{ fontWeight:800, fontSize:16, color:'#111', textDecoration:'none' }}>
                  {r.title}
                </Link>
                <span style={chipInfo}>모집중</span>
              </div>
              <div style={{ color:'#555', fontSize:13, marginTop:6 }}>
                <div>장소: {r.location}</div>
                <div>시간: {human(r.startAt)}</div>
              </div>
              <div style={{ marginTop:10, display:'flex', gap:8 }}>
                <Link href={`/room/${r.id}`} style={btnSmall}>상세보기</Link>
                <Link href="/room" style={btnSmall}>더 보기</Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const btnPrimary: React.CSSProperties = { padding:'10px 14px', borderRadius:10, background:'#111', color:'#fff', textDecoration:'none', border:'1px solid #111' };
const btnSecondary: React.CSSProperties = { padding:'10px 14px', borderRadius:10, background:'#fff', color:'#111', textDecoration:'none', border:'1px solid #ddd' };
const btnGhost: React.CSSProperties = { padding:'10px 14px', borderRadius:10, background:'transparent', color:'#111', textDecoration:'none', border:'1px dashed #ccc' };
const btnSmall: React.CSSProperties = { padding:'6px 10px', borderRadius:8, border:'1px solid #ddd', background:'#fff', color:'#111', textDecoration:'none' };
const card: React.CSSProperties = { border:'1px solid #e9e9ec', borderRadius:12, padding:14, background:'#fff' };
const chipInfo: React.CSSProperties = { fontSize:12, padding:'2px 8px', borderRadius:999, border:'1px solid #ddd', background:'#eef2ff', color:'#3730a3' };
const heroCard: React.CSSProperties = { border:'1px solid #e9e9ec', borderRadius:12, padding:16, background:'#fff' };
