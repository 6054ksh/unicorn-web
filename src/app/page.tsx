'use client';

import { useEffect, useMemo, useState } from 'react';
import HomeNav from '@/components/HomeNav';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, limit, onSnapshot, getDocs, documentId } from 'firebase/firestore';
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
  const [uid, setUid] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [users, setUsers] = useState<Record<string, UserMeta>>({});
  const [vote, setVote] = useState({ thumbsForUid: '', heartForUid: '', noshowUid: 'none' });
  const [msg, setMsg] = useState('');

  const auth = useMemo(() => getAuth(firebaseApp), []);
  const db = useMemo(() => getFirestore(firebaseApp), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, [auth]);

  // 내가 참여한 최신 방(진행중/예정/종료+24h) 1개
  useEffect(() => {
    if (!uid) { setRoom(null); return; }
    const now = new Date();

    const qy = query(
      collection(db, 'rooms'),
      where('participants', 'array-contains', uid),
      orderBy('startAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map(d => ({ id:d.id, ...(d.data() as any) })) as Room[];
      const picked = rows.find(r => {
        const end = new Date(r.endAt);
        const endedWithin1d = now < new Date(end.getTime() + 24*60*60*1000);
        const notClosedYet = !r.closed;
        return notClosedYet || endedWithin1d;
      });
      setRoom(picked || null);

      // 참가자 메타 로딩
      if (picked?.participants?.length) {
        (async () => {
          const ids = picked.participants!;
          const chunks: string[][] = [];
          for (let i=0;i<ids.length;i+=10) chunks.push(ids.slice(i,i+10));
          const map: Record<string, UserMeta> = {};
          for (const g of chunks) {
            const uQ = query(collection(db, 'users'), where(documentId(), 'in', g));
            const uS = await getDocs(uQ);
            uS.forEach(d => {
              const v = d.data() as any;
              map[d.id] = { uid:d.id, name: v?.name || '(이름없음)', profileImage: v?.profileImage || '' };
            });
          }
          setUsers(map);
        })();
      } else {
        setUsers({});
      }
    });
    return () => unsub();
  }, [db, uid]);

  const stateLabel = (r: Room | null) => {
    if (!r) return '';
    const now = new Date();
    if (r.closed) return '종료';
    if (now >= new Date(r.startAt)) return '진행중';
    return '모집중';
    // 종료 +24h 동안은 상단에 보이되 label은 '종료'로 표시
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

  return (
    <main style={{ padding: 0, background:'#fafafa', minHeight:'100vh' }}>
      <HomeNav />

      <section style={{ padding: 20, display:'grid', gap:16, maxWidth: 960, margin:'0 auto' }}>
        <header style={{ display:'grid', gap:6 }}>
          <h1 style={{ margin:0, fontSize: 24, fontWeight:800 }}>UNIcorn 🦄</h1>
          <p style={{ margin:0, color:'#666' }}>친해지고, 섞이고, 재밌게! 학생회 모임 매칭</p>
        </header>

        {/* 내 모임 카드 */}
        {uid ? (
          <div style={{ border:'1px solid #e5e7eb', borderRadius:14, background:'#fff', padding:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
              <div style={{ fontSize:16, fontWeight:800 }}>내 모임</div>
              {room ? (
                <span style={{
                  fontSize: 12, padding:'2px 8px', borderRadius:999, border:'1px solid #ddd',
                  background: stateLabel(room)==='진행중' ? '#e6f4ea' : stateLabel(room)==='종료' ? '#f3f4f6' : '#eef2ff',
                  color: stateLabel(room)==='진행중' ? '#166534' : stateLabel(room)==='종료' ? '#374151' : '#3730a3'
                }}>
                  {stateLabel(room)}
                </span>
              ) : null}
            </div>

            {room ? (
              <>
                <div style={{ marginTop:6, color:'#333' }}>
                  <a href={`/room/${room.id}`} style={{ textDecoration:'none', color:'#111', fontWeight:700 }}>
                    {room.title}
                  </a>
                  <div style={{ fontSize:13, color:'#666', marginTop:4 }}>
                    장소: {room.location} · 시간: {new Date(room.startAt).toLocaleString()} ~ {new Date(room.endAt).toLocaleString()}
                  </div>

                  {/* 투표 패널: 종료 후 24h 동안 표시 */}
                  {new Date() >= new Date(room.endAt) && new Date() < new Date(new Date(room.endAt).getTime()+24*60*60*1000) ? (
                    <div style={{ marginTop:12, borderTop:'1px dashed #eee', paddingTop:12 }}>
                      <div style={{ fontWeight:700, marginBottom:6 }}>모임 투표</div>
                      <div style={{ display:'grid', gap:8, maxWidth:520 }}>
                        <label style={{ display:'grid', gap:4 }}>
                          <span>👍 따봉 줄 사람</span>
                          <select value={vote.thumbsForUid} onChange={e=>setVote(v=>({ ...v, thumbsForUid: e.target.value }))}>
                            <option value="">선택 안 함</option>
                            {(room.participants||[]).map(u => (
                              <option key={u} value={u}>{users[u]?.name || u}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display:'grid', gap:4 }}>
                          <span>❤️ 하트 줄 사람</span>
                          <select value={vote.heartForUid} onChange={e=>setVote(v=>({ ...v, heartForUid: e.target.value }))}>
                            <option value="">선택 안 함</option>
                            {(room.participants||[]).map(u => (
                              <option key={u} value={u}>{users[u]?.name || u}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display:'grid', gap:4 }}>
                          <span>🚫 노쇼 투표</span>
                          <select value={vote.noshowUid} onChange={e=>setVote(v=>({ ...v, noshowUid: e.target.value }))}>
                            <option value="none">노쇼자 없음</option>
                            {(room.participants||[]).map(u => (
                              <option key={u} value={u}>{users[u]?.name || u}</option>
                            ))}
                          </select>
                        </label>
                        <div>
                          <button onClick={submitVote} style={{ padding:'8px 12px', borderRadius:8, background:'#111', color:'#fff' }}>
                            투표하기
                          </button>
                          <span style={{ marginLeft:8, color: msg.startsWith('❌') ? 'crimson' : '#333' }}>{msg}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div style={{ color:'#666', fontSize:13 }}>참여 중이거나 최근(24시간 내) 종료된 모임이 없습니다.</div>
            )}
          </div>
        ) : (
          <div style={{ border:'1px solid #e5e7eb', borderRadius:14, background:'#fff', padding:14 }}>
            <div style={{ fontWeight:800 }}>로그인이 필요합니다</div>
            <p style={{ marginTop:4, color:'#666' }}>
              <a href="/login">로그인</a> 후 내 모임과 투표를 이용하세요.
            </p>
          </div>
        )}

        {/* 빠른 이동 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))', gap:10 }}>
          <a href="/room" className="cardLink" style={card}>모임 목록 보기</a>
          <a href="/room/new" className="cardLink" style={card}>모임 만들기</a>
          <a href="/scores" className="cardLink" style={card}>점수판</a>
          <a href="/notifications/enable" className="cardLink" style={card}>알림 설정</a>
        </div>
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  display:'block', padding:14, border:'1px solid #e5e7eb', borderRadius:14, background:'#fff', textDecoration:'none', color:'#111', fontWeight:700
};
