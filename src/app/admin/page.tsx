// src/app/admin/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { firebaseApp } from '@/lib/firebase';
import {
  getFirestore, doc, getDoc, onSnapshot, collection, query,
  orderBy, startAt as fsStartAt, endAt as fsEndAt, limit as fsLimit,
  where, getDocs, documentId
} from 'firebase/firestore';
import { authedFetch } from '@/lib/authedFetch';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

type Room = {
  id: string;
  title: string;
  titleLower?: string;
  startAt: string;
  endAt: string;
  revealAt: string;
  capacity?: number;
  participants?: string[];
  participantsCount?: number;
  closed?: boolean;
  type?: string;
  content?: string;
};

type UserRow = {
  uid: string;
  name?: string;
  nameLower?: string;
  profileImage?: string;
};

export default function AdminPage() {
  // ---------- 인증 ----------
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminError, setAdminError] = useState('');

  // ---------- 방/참가자 ----------
  const [roomId, setRoomId] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [participantsProfiles, setParticipantsProfiles] = useState<Record<string, UserRow>>({});
  const [checkedNoshow, setCheckedNoshow] = useState<Record<string, boolean>>({});
  const [awards, setAwards] = useState<{ komangshot?: string; allTimeLegend?: string; playmaker?: string }>({});
  const [msg, setMsg] = useState('');

  // ---------- 방 검색 ----------
  const [qTitle, setQTitle] = useState('');
  const [qFrom, setQFrom] = useState<string>(''); // yyyy-MM-ddTHH:mm
  const [qTo, setQTo] = useState<string>('');
  const [roomResults, setRoomResults] = useState<Room[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all'|'ready'|'live'|'closed'>('all');

  // ---------- 사용자 검색/점수 ----------
  const [qUserName, setQUserName] = useState('');
  const [userResults, setUserResults] = useState<UserRow[]>([]);
  const [scoreDelta, setScoreDelta] = useState<number>(0);
  const [scoreReason, setScoreReason] = useState('');
  const [selectedUserUid, setSelectedUserUid] = useState<string>('');

  // Auth 구독
  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // 어드민 확인
  useEffect(() => {
    const run = async () => {
      setAdminError('');
      setIsAdmin(null);
      if (!authReady) return;
      if (!currentUser) {
        setIsAdmin(false);
        setAdminError('로그인이 필요합니다. /login에서 로그인 후 다시 시도하세요.');
        return;
      }
      try {
        const db = getFirestore(firebaseApp);
        const snap = await getDoc(doc(db, 'admins', currentUser.uid));
        const ok = snap.exists() && !!snap.data()?.isAdmin;
        setIsAdmin(ok);
        if (!ok) {
          setAdminError('admins/{내UID} 문서가 없습니다. isAdmin: true(불리언)으로 추가하세요.');
        }
      } catch (e: any) {
        setIsAdmin(false);
        setAdminError(
          'admins 읽기 권한 오류. 규칙에 다음을 추가하세요:\n' +
          "match /admins/{userId} {\n" +
          "  allow read: if request.auth != null && request.auth.uid == userId;\n" +
          "  allow write: if false;\n" +
          "}\n"
        );
      }
    };
    run();
  }, [authReady, currentUser]);

  // roomId 구독
  useEffect(() => {
    if (!roomId) { setRoom(null); setCheckedNoshow({}); setAwards({}); setParticipantsProfiles({}); return; }
    const db = getFirestore(firebaseApp);
    const ref = doc(db, 'rooms', roomId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) { setRoom(null); setCheckedNoshow({}); setAwards({}); setParticipantsProfiles({}); return; }
      const data = snap.data() as any;
      const r: Room = { id: snap.id, ...data };
      setRoom(r);

      const uids: string[] = r.participants || [];
      const init: Record<string, boolean> = {};
      uids.forEach((u) => { init[u] = false; });
      setCheckedNoshow(init);

      fetchUserProfiles(uids).then(setParticipantsProfiles);
    }, (err) => {
      setMsg('❌ 방 구독 에러: ' + (err?.message ?? String(err)));
    });
    return () => unsub();
  }, [roomId]);

  async function fetchUserProfiles(uids: string[]) {
    const db = getFirestore(firebaseApp);
    const usersCol = collection(db, 'users');
    const res: Record<string, UserRow> = {};
    if (!uids.length) return res;
    for (let i = 0; i < uids.length; i += 10) {
      const g = uids.slice(i, i + 10);
      const q = query(usersCol, where(documentId(), 'in', g));
      const snap = await getDocs(q);
      snap.forEach(d => {
        const v = d.data() as any;
        res[d.id] = {
          uid: d.id,
          name: v?.name || '(이름없음)',
          nameLower: v?.nameLower || '',
          profileImage: v?.profileImage || '',
        };
      });
    }
    return res;
  }

  // 방 검색
  const applyStatusFilter = (arr: Room[]) => {
    if (statusFilter === 'all') return arr;
    const now = new Date();
    return arr.filter(r => {
      const started = now >= new Date(r.startAt);
      if (statusFilter === 'closed') return !!r.closed;
      if (statusFilter === 'live') return !r.closed && started;
      if (statusFilter === 'ready') return !r.closed && !started;
      return true;
    });
  };

  const searchRoomsByTitle = async () => {
    if (!qTitle.trim()) { setRoomResults([]); return; }
    const key = qTitle.trim().toLowerCase();
    const db = getFirestore(firebaseApp);
    const qy = query(
      collection(db, 'rooms'),
      orderBy('titleLower'),
      fsStartAt(key),
      fsEndAt(key + '\uf8ff'),
      fsLimit(50)
    );
    const snap = await getDocs(qy);
    const arr: Room[] = [];
    snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
    setRoomResults(applyStatusFilter(arr));
  };

  const searchRoomsByDate = async () => {
    if (!qFrom || !qTo) { setRoomResults([]); return; }
    const fromIso = new Date(qFrom).toISOString();
    const toIso = new Date(qTo).toISOString();
    const db = getFirestore(firebaseApp);
    const qy = query(
      collection(db, 'rooms'),
      where('startAt', '>=', fromIso),
      where('startAt', '<=', toIso),
      orderBy('startAt', 'desc'),
      fsLimit(100)
    );
    const snap = await getDocs(qy);
    const arr: Room[] = [];
    snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
    setRoomResults(applyStatusFilter(arr));
  };

  // 🔎 사용자 이름 검색 (접두 검색)
const searchUsersByName = async () => {
  const key = qUserName.trim().toLowerCase();
  if (!key) { 
    setUserResults([]); 
    return; 
  }

  const db = getFirestore(firebaseApp);
  const qy = query(
    collection(db, 'users'),
    orderBy('nameLower'),
    fsStartAt(key),
    fsEndAt(key + '\uf8ff'),
    fsLimit(50)
  );

  const snap = await getDocs(qy);
  const arr: UserRow[] = [];
  snap.forEach(d => {
    const v = d.data() as any;
    arr.push({
      uid: d.id,
      name: v?.name || '(이름없음)',
      nameLower: v?.nameLower || '',
      profileImage: v?.profileImage || '',
    });
  });
  setUserResults(arr);
};

  // 액션
  const onCloseRoom = async () => {
    if (!roomId) return;
    setMsg('방 종료 중...');
    const res = await authedFetch('/api/admin/rooms/close', { method: 'POST', body: JSON.stringify({ roomId }) });
    const j = await res.json();
    setMsg(res.ok ? '✅ 방 종료 완료' : '❌ ' + (j.error || '실패'));
  };

  const onApplyNoshow = async () => {
    if (!roomId) return;
    const uids = Object.keys(checkedNoshow).filter(k => checkedNoshow[k]);
    if (!uids.length) { setMsg('❌ 체크된 인원이 없습니다.'); return; }
    setMsg('노쇼 반영 중...');
    const res = await authedFetch('/api/admin/rooms/noshow', { method: 'POST', body: JSON.stringify({ roomId, uids }) });
    const j = await res.json();
    setMsg(res.ok ? `✅ 노쇼 ${uids.length}명 반영` : '❌ ' + (j.error || '실패'));
  };

  const onAwardTitles = async () => {
    if (!roomId) return;
    setMsg('칭호 수여 중...');
    const res = await authedFetch('/api/admin/rooms/award-titles', { method: 'POST', body: JSON.stringify({ roomId, awards }) });
    const j = await res.json();
    setMsg(res.ok ? '✅ 칭호 수여 완료' : '❌ ' + (j.error || '실패'));
  };

  const onApplyScore = async () => {
    if (!selectedUserUid) { setMsg('❌ 사용자 선택 필요'); return; }
    if (!Number.isFinite(scoreDelta)) { setMsg('❌ 점수는 숫자'); return; }
    setMsg('점수 조정 중...');
    const res = await authedFetch('/api/admin/scores/apply', {
      method: 'POST',
      body: JSON.stringify({ targetUid: selectedUserUid, delta: Number(scoreDelta), reason: scoreReason })
    });
    const j = await res.json();
    setMsg(res.ok ? '✅ 점수 조정 완료' : '❌ ' + (j.error || '실패'));
  };

  const onBackfillLower = async () => {
    setMsg('인덱스 필드 백필 중...');
    const res = await authedFetch('/api/admin/tools/backfill-lower', { method: 'POST' });
    const j = await res.json();
    setMsg(res.ok ? `✅ 백필 완료: ${j.countRooms} rooms, ${j.countUsers} users` : '❌ ' + (j.error || '실패'));
  };

  // 렌더링 분기
  if (!authReady) return <main style={{ padding: 24 }}>관리자 확인 중…</main>;
  if (!currentUser) {
    return (
      <main style={{ padding: 24 }}>
        <h1>어드민 대시보드</h1>
        <p style={{ color:'#c00' }}>로그인이 필요합니다.</p>
        <p><a href="/login">/login</a> 에서 로그인 후 다시 시도하세요.</p>
      </main>
    );
  }
  if (isAdmin === null) return <main style={{ padding: 24 }}>관리자 확인 중…</main>;
  if (isAdmin === false) {
    return (
      <main style={{ padding: 24, maxWidth: 860 }}>
        <h1>어드민 대시보드</h1>
        <div style={cardWarn}>
          <p style={{ whiteSpace:'pre-wrap', margin:0 }}>{adminError || '어드민 권한이 없습니다.'}</p>
        </div>
      </main>
    );
  }

  // ---- 어드민 OK ----
  const started = room ? new Date() >= new Date(room.startAt) : false;
  const stateLabel = room ? (room.closed ? '종료됨' : (started ? '모임중/이후' : '준비중')) : '-';

  return (
    <main style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
        <h1>어드민 대시보드</h1>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onBackfillLower} style={btnSecondary}>인덱스필드 백필</button>
          <a href="/scores" style={{ ...btnLink, textDecoration:'none' }}>점수판 열기</a>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.15fr 1fr', gap:24, alignItems:'start', marginTop:16 }}>
        {/* 좌측: 검색 */}
        <section>
          <div style={card}>
            <h2 style={h2}>방 검색 / 선택</h2>

            <div style={sectionBox}>
              <h3 style={h3}>제목으로 검색</h3>
              <div style={row}>
                <input placeholder="제목 일부(접두) 입력" value={qTitle} onChange={e=>setQTitle(e.target.value)} style={inputStyle} />
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)} style={selectStyle}>
                  <option value="all">전체</option>
                  <option value="ready">모집중</option>
                  <option value="live">모임중/시작됨</option>
                  <option value="closed">종료됨</option>
                </select>
                <button onClick={searchRoomsByTitle} style={btnPrimary}>검색</button>
              </div>
            </div>

            <div style={sectionBox}>
              <h3 style={h3}>날짜로 검색</h3>
              <div style={{ ...row, flexWrap:'wrap' }}>
                <label>시작 ≥ <input type="datetime-local" value={qFrom} onChange={e=>setQFrom(e.target.value)} style={inputStyle} /></label>
                <label>시작 ≤ <input type="datetime-local" value={qTo}   onChange={e=>setQTo(e.target.value)} style={inputStyle} /></label>
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)} style={selectStyle}>
                  <option value="all">전체</option>
                  <option value="ready">모집중</option>
                  <option value="live">모임중/시작됨</option>
                  <option value="closed">종료됨</option>
                </select>
                <button onClick={searchRoomsByDate} style={btnPrimary}>검색</button>
              </div>
            </div>

            <div style={sectionBox}>
              <h3 style={h3}>검색 결과</h3>
              <div style={tableWrap}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>제목</th>
                      <th style={th}>시작</th>
                      <th style={th}>상태</th>
                      <th style={th}>인원</th>
                      <th style={th}>액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomResults.map(r => {
                      const started = new Date() >= new Date(r.startAt);
                      const state = r.closed ? '종료' : (started ? '모임중' : '준비중');
                      return (
                        <tr key={r.id}>
                          <td style={tdLeft}>{r.title}</td>
                          <td style={tdLeft}>{new Date(r.startAt).toLocaleString()}</td>
                          <td style={tdCenter}>{state}</td>
                          <td style={tdCenter}>{(r.participantsCount||0)}/{r.capacity||0}</td>
                          <td style={tdCenter}>
                            <button onClick={()=>setRoomId(r.id)} style={btnSmall}>열기</button>
                            <button onClick={()=>navigator.clipboard.writeText(r.id)} style={btnSmall}>ID복사</button>
                          </td>
                        </tr>
                      );
                    })}
                    {!roomResults.length && (
                      <tr><td colSpan={5} style={{ padding:10, textAlign:'center', color:'#777' }}>결과 없음</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop:10 }}>
                <label>
                  또는 방 ID 직접입력:&nbsp;
                  <input value={roomId} onChange={e=>setRoomId(e.target.value)} style={{ ...inputStyle, width:360 }} />
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* 우측: 방 관리/점수 */}
        <section>
          <div style={card}>
            <h2 style={h2}>방 관리</h2>
            {room ? (
              <>
                <div style={{ ...badgeRow }}>
                  <span style={badgePrimary}>{stateLabel}</span>
                  {room.type ? <span style={badge}>{room.type}</span> : null}
                </div>
                <div style={{ color:'#444', lineHeight:1.7 }}>
                  <div><b>{room.title}</b></div>
                  <div>시간: {new Date(room.startAt).toLocaleString()} ~ {new Date(room.endAt).toLocaleString()}</div>
                  <div>공개: {new Date(room.revealAt).toLocaleString()}</div>
                  {typeof room.capacity === 'number' ? <div>정원: {room.capacity}명</div> : null}
                </div>
                <div style={{ marginTop:8, display:'flex', gap:8 }}>
                  <button onClick={onCloseRoom} disabled={!roomId || room.closed} style={btnDanger}>방 강제 종료</button>
                  <a href={`/room/${room.id}`} target="_blank" rel="noreferrer" style={btnSecondary}>참여 페이지 열기</a>
                </div>

                <hr style={{ margin:'12px 0' }} />

                <h3 style={h3}>노쇼 처리 (-20점)</h3>
                <p style={{ marginTop:0, color:'#666' }}>참여자에서 체크 후 적용</p>
                <div style={gridUsers}>
                  {(room.participants || []).map((uid) => {
                    const p = participantsProfiles[uid];
                    return (
                      <label key={uid} style={userChip}>
                        <input
                          type="checkbox"
                          checked={!!checkedNoshow[uid]}
                          onChange={e=>setCheckedNoshow(s=>({ ...s, [uid]: e.target.checked }))}
                        />
                        {p?.profileImage ? (
                          <img src={p.profileImage} alt={p?.name || uid} style={avatar} />
                        ) : (
                          <div style={avatarEmpty}>?</div>
                        )}
                        <span>{p?.name || uid}</span>
                        <small style={{ marginLeft:'auto', color:'#999' }}>{uid.slice(0,6)}…</small>
                      </label>
                    );
                  })}
                  {!(room.participants||[]).length && <div>참여자가 없습니다.</div>}
                </div>
                <button onClick={onApplyNoshow} style={{ ...btnPrimary, marginTop:8 }}>
                  노쇼 반영 ({Object.values(checkedNoshow).filter(Boolean).length}명)
                </button>

                <hr style={{ margin:'12px 0' }} />

                <h3 style={h3}>칭호 수여</h3>
                <div style={{ display:'grid', gap:8, maxWidth: 420 }}>
                  <AwardSelect label="코맹샷" value={awards.komangshot || ''} onChange={(v)=>setAwards(s=>({ ...s, komangshot: v }))} options={room.participants||[]} profiles={participantsProfiles} />
                  <AwardSelect label="올타임레전드" value={awards.allTimeLegend || ''} onChange={(v)=>setAwards(s=>({ ...s, allTimeLegend: v }))} options={room.participants||[]} profiles={participantsProfiles} />
                  <AwardSelect label="플레이메이커" value={awards.playmaker || ''} onChange={(v)=>setAwards(s=>({ ...s, playmaker: v }))} options={room.participants||[]} profiles={participantsProfiles} />
                </div>
                <button onClick={onAwardTitles} style={{ ...btnPrimary, marginTop:8 }}>칭호 수여</button>
              </>
            ) : (
              <div style={mutedBox}><p style={{ margin:0 }}>왼쪽에서 방을 선택하거나 ID를 입력하세요.</p></div>
            )}
          </div>

          <div style={{ height:16 }} />

          <div style={card}>
            <h2 style={h2}>사용자 점수 가감</h2>
            <div style={row}>
              <input placeholder="이름 일부(접두) 검색" value={qUserName} onChange={e=>setQUserName(e.target.value)} style={inputStyle} />
              <button onClick={searchUsersByName} style={btnPrimary}>검색</button>
            </div>
            <div style={tableWrapSm}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>이름</th>
                    <th style={th}>UID</th>
                    <th style={th}>선택</th>
                  </tr>
                </thead>
                <tbody>
                  {userResults.map(u => (
                    <tr key={u.uid}>
                      <td style={tdLeft}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {u.profileImage ? <img src={u.profileImage} alt={u.name} style={avatarSm} /> : <div style={avatarSmEmpty}>?</div>}
                          <span>{u.name || '(이름없음)'}</span>
                        </div>
                      </td>
                      <td style={tdLeft}><code>{u.uid}</code></td>
                      <td style={tdCenter}>
                        <button onClick={()=>setSelectedUserUid(u.uid)} style={btnSmall}>선택</button>
                      </td>
                    </tr>
                  ))}
                  {!userResults.length && (
                    <tr><td colSpan={3} style={{ padding:10, textAlign:'center', color:'#777' }}>결과 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop:10 }}>
              <div>선택된 UID: <code>{selectedUserUid || '(없음)'}</code></div>
              <div style={{ ...row, flexWrap:'wrap', marginTop:8 }}>
                <label>점수 변화 <input type="number" value={Number.isFinite(scoreDelta)? scoreDelta : 0} onChange={e=>setScoreDelta(parseFloat(e.target.value))} style={{ ...inputStyle, width:120 }} /></label>
                <input placeholder="사유(선택)" value={scoreReason} onChange={e=>setScoreReason(e.target.value)} style={{ ...inputStyle, width:260 }} />
                <button onClick={onApplyScore} disabled={!selectedUserUid} style={btnSecondary}>점수 적용</button>
              </div>
            </div>
          </div>

          <div style={{ marginTop:12, minHeight:24 }}>{msg && <div style={msg.startsWith('✅') ? toastOk : toastErr}>{msg}</div>}</div>
        </section>
      </div>
    </main>
  );
}

function AwardSelect({
  label, value, onChange, options, profiles
}:{
  label:string; value:string; onChange:(v:string)=>void; options:string[]; profiles:Record<string, UserRow>;
}) {
  return (
    <label style={{ display:'grid', gap:4 }}>
      <span style={{ fontSize:13, color:'#555' }}>{label}</span>
      <select value={value} onChange={e=>onChange(e.target.value)} style={selectStyle}>
        <option value="">선택 안 함</option>
        {options.map(uid => {
          const u = profiles[uid];
          const name = u?.name || uid;
          return <option key={uid} value={uid}>{name} ({uid.slice(0,6)}…)</option>;
        })}
      </select>
    </label>
  );
}

// --- 스타일 공통 ---
const card: React.CSSProperties = { border:'1px solid #eee', borderRadius:12, padding:16, background:'#fff' };
const cardWarn: React.CSSProperties = { border:'1px solid #f0dada', background:'#fff6f6', borderRadius:12, padding:16 };
const sectionBox: React.CSSProperties = { borderTop:'1px solid #f3f3f4', paddingTop:10, marginTop:10 };
const row: React.CSSProperties = { display:'flex', gap:8, alignItems:'center' };
const tableWrap: React.CSSProperties = { maxHeight: 360, overflow:'auto', marginTop:8, border:'1px solid #eee', borderRadius:8 };
const tableWrapSm: React.CSSProperties = { maxHeight: 260, overflow:'auto', marginTop:8, border:'1px solid #eee', borderRadius:8 };
const table: React.CSSProperties = { borderCollapse:'collapse', width:'100%' };
const th: React.CSSProperties = { textAlign:'left', padding:'8px 10px', borderBottom:'1px solid #eee', whiteSpace:'nowrap', background:'#fafafa' };
const tdLeft: React.CSSProperties = { textAlign:'left', padding:'8px 10px', borderBottom:'1px solid #f6f6f6', whiteSpace:'nowrap' };
const tdCenter: React.CSSProperties = { textAlign:'center', padding:'8px 10px', borderBottom:'1px solid #f6f6f6', whiteSpace:'nowrap' };

const btnPrimary: React.CSSProperties = { padding:'8px 12px', borderRadius:8, border:'1px solid #111', background:'#111', color:'#fff', cursor:'pointer' };
const btnSecondary: React.CSSProperties = { padding:'8px 12px', borderRadius:8, border:'1px solid #ddd', background:'#fff', color:'#111', cursor:'pointer' };
const btnSmall: React.CSSProperties = { padding:'6px 10px', borderRadius:8, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:12 };
const btnDanger: React.CSSProperties = { padding:'8px 12px', borderRadius:8, border:'1px solid #b91c1c', background:'#b91c1c', color:'#fff', cursor:'pointer' };
const btnLink: React.CSSProperties = { padding:'8px 12px', borderRadius:8, border:'1px solid #ddd', background:'#fff', color:'#111', cursor:'pointer' };

const h2: React.CSSProperties = { margin:'2px 0 8px', fontSize:18 };
const h3: React.CSSProperties = { margin:'0 0 6px', fontSize:14, color:'#333' };
const mutedBox: React.CSSProperties = { background:'#fafafa', border:'1px dashed #ddd', borderRadius:8, padding:12 };
const toastOk: React.CSSProperties = { background:'#e7f6ec', border:'1px solid #b7e1c4', borderRadius:8, padding:'8px 12px', color:'#14532d' };
const toastErr: React.CSSProperties = { background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'8px 12px', color:'#7f1d1d' };

const badgeRow: React.CSSProperties = { display:'flex', gap:8, marginBottom:6, alignItems:'center' };
const badge: React.CSSProperties = { fontSize:12, padding:'2px 8px', borderRadius:999, border:'1px solid #ddd', background:'#f7f7f9', color:'#444' };
const badgePrimary: React.CSSProperties = { ...badge, background:'#eef2ff', color:'#3730a3', borderColor:'#e0e7ff' };

const gridUsers: React.CSSProperties = { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:8 };
const userChip: React.CSSProperties = { border:'1px solid #eee', borderRadius:8, padding:8, display:'flex', alignItems:'center', gap:8, background:'#fff' };
const avatar: React.CSSProperties = { width:24, height:24, borderRadius:'50%', objectFit:'cover' };
const avatarEmpty: React.CSSProperties = { width:24, height:24, borderRadius:'50%', background:'#eee', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12 };
const avatarSm: React.CSSProperties = { width:22, height:22, borderRadius:'50%', objectFit:'cover' };
const avatarSmEmpty: React.CSSProperties = { width:22, height:22, borderRadius:'50%', background:'#eee', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11 };

// 🔧 새로 추가된 스타일 헬퍼 (이 이름들 때문에 에러났던 부분!)
const inputStyle: React.CSSProperties = { padding:'6px 10px', borderRadius:8, border:'1px solid #ddd' };
const selectStyle: React.CSSProperties = { padding:'6px 10px', borderRadius:8, border:'1px solid #ddd', background:'#fff' };
