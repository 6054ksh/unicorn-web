'use client';

import { useEffect, useMemo, useState } from 'react';
import HomeNav from '@/components/HomeNav';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, onSnapshot, getDocs, documentId } from 'firebase/firestore';
import { authedFetch } from '@/lib/authedFetch';

type Room = {
  id: string;
  title: string;
  location: string;
  capacity: number;
  minCapacity?: number;
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
  const [vote, setVote] = useState({ roomId: '', thumbsForUid: '', heartForUid: '', noshowUid: 'none' });
  const [msg, setMsg] = useState('');

  const auth = useMemo(() => getAuth(firebaseApp), []);
  const db = useMemo(() => getFirestore(firebaseApp), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, [auth]);

  // 내가 참여한 방 전체(최근 몇 개)를 받아서 클라에서 정렬/필터
  useEffect(() => {
    if (!uid) { setMyRooms([]); setUsers({}); return; }

    const qy = query(
      collection(db, 'rooms'),
      where('participants', 'array-contains', uid),
    );
    const unsub = onSnapshot(qy, async (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Room[];

      // 종료 +24h 이내 or 미종료(모집/진행)만 남김
      const now = Date.now();
      const kept = all.filter(r => {
        if (!r.endAt) return true;
        const end = new Date(r.endAt).getTime();
        const endedWithin1d = now < end + 24 * 60 * 60 * 1000;
        return !r.closed || endedWithin1d;
      });

      // 최근 시작순으로 정렬
      kept.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

      // 최신 3개만 보여줌 (필요 시 늘릴 수 있음)
      const top = kept.slice(0, 3);
      setMyRooms(top);

      // 유저 프로필 로드 (참가자 집합)
      const ids = Array.from(new Set(top.flatMap(r => r.participants || [])));
      if (!ids.length) { setUsers({}); return; }
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

      // 가장 최근 “종료된” 방 1개 잡아서 투표 roomId로 설정
      const ended = kept
        .filter(r => new Date().getTime() >= new Date(r.endAt).getTime())
        .sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime());
      setVote(v => ({ ...v, roomId: ended[0]?.id || '' }));
    }, (err) => {
      console.warn('my rooms snapshot error', err);
      setMyRooms([]);
    });

    return () => unsub();
  }, [db, uid]);

  const stateLabel = (r: Room) => {
    const now = new Date();
    if (r.closed) return '종료';
    if (now >= new Date(r.startAt)) return '진행중';
    return '모집중';
  };

  const fmt = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return isNaN(d as any) ? iso : d.toLocaleString();
  };

  const submitVote = async () => {
    const room = myRooms.find(r => r.id === vote.roomId);
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
          <h1 style={{ margin:0, fontSize: 26, fontWeight:800 }}>UNIcorn 🦄</h1>
          <p style={{ margin:0, color:'#666' }}>친해지고, 섞이고, 재밌게! 학생회 모임 매칭</p>
        </header>

        {/* 내 모임들 */}
        <div style={{ border:'1px solid #e5e7eb', borderRadius:14, background:'#fff', padding:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
            <div style={{ fontSize:16, fontWeight:800 }}>내 모임</div>
            {uid ? <a href="/room" style={{ fontSize:12, color:'#555' }}>모임 목록 전체보기 →</a> : null}
          </div>

          {!uid && (
            <div style={{ color:'#666', fontSize:13, marginTop:6 }}>
              <b>로그인이 필요합니다.</b> <a href="/login">로그인</a> 후 참여/투표를 이용하세요.
            </div>
          )}

          {uid && myRooms.length === 0 && (
            <div style={{ color:'#666', fontSize:13, marginTop:6 }}>참여 중이거나 최근(24시간 내) 종료된 모임이 없습니다.</div>
          )}

          {uid && myRooms.length > 0 && (
            <div style={{ display:'grid', gap:10, marginTop:8 }}>
              {myRooms.map((r) => (
                <div key={r.id} style={{ border:'1px solid #eee', borderRadius:10, padding:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <a href={`/room/${r.id}`} style={{ textDecoration:'none', color:'#111', fontWeight:700 }}>
                      {r.title}
                    </a>
                    <span style={{
                      fontSize: 12, padding:'2px 8px', borderRadius:999, border:'1px solid #ddd',
                      background: stateLabel(r)==='진행중' ? '#e6f4ea' : stateLabel(r)==='종료' ? '#f3f4f6' : '#eef2ff',
                      color: stateLabel(r)==='진행중' ? '#166534' : stateLabel(r)==='종료' ? '#374151' : '#3730a3'
                    }}>
                      {stateLabel(r)}
                    </span>
                  </div>
                  <div style={{ fontSize:13, color:'#666', marginTop:4 }}>
                    장소: {r.location} · 시간: {fmt(r.startAt)} ~ {fmt(r.endAt)}
                    {typeof r.minCapacity === 'number' ? <> · 최소시작: {r.minCapacity}명</> : null}
                    {' · '}정원: {r.capacity}명 / 참여: {r.participantsCount ?? (r.participants?.length ?? 0)}명
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 투표 패널: 가장 최근 종료 방 1개만 노출 (기능 유지) */}
        {uid && vote.roomId && (
          <div style={{ border:'1px dashed #e5e7eb', borderRadius:14, background:'#fff', padding:14 }}>
            <div style={{ fontWeight:700, marginBottom:6 }}>모임 투표 (종료 후 24시간)</div>
            <div style={{ display:'grid', gap:8, maxWidth:520 }}>
              <label style={{ display:'grid', gap:4 }}>
                <span>👍 따봉 줄 사람</span>
                <select
                  value={vote.thumbsForUid}
                  onChange={e=>setVote(v=>({ ...v, thumbsForUid: e.target.value }))}
                >
                  <option value="">선택 안 함</option>
                  {(myRooms.find(r => r.id === vote.roomId)?.participants || []).map(u => (
                    <option key={u} value={u}>{users[u]?.name || u}</option>
                  ))}
                </select>
              </label>
              <label style={{ display:'grid', gap:4 }}>
                <span>❤️ 하트 줄 사람</span>
                <select
                  value={vote.heartForUid}
                  onChange={e=>setVote(v=>({ ...v, heartForUid: e.target.value }))}
                >
                  <option value="">선택 안 함</option>
                  {(myRooms.find(r => r.id === vote.roomId)?.participants || []).map(u => (
                    <option key={u} value={u}>{users[u]?.name || u}</option>
                  ))}
                </select>
              </label>
              <label style={{ display:'grid', gap:4 }}>
                <span>🚫 노쇼 투표</span>
                <select
                  value={vote.noshowUid}
                  onChange={e=>setVote(v=>({ ...v, noshowUid: e.target.value }))}
                >
                  <option value="none">노쇼자 없음</option>
                  {(myRooms.find(r => r.id === vote.roomId)?.participants || []).map(u => (
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
        )}

        {/* 중복 이동 버튼 영역은 제거(HomeNav만 유지) */}
      </section>
    </main>
  );
}
