'use client';

import { useEffect, useMemo, useState } from 'react';
import { firebaseApp } from '@/lib/firebase';
import { getFirestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { authedFetch } from '@/lib/authedFetch';
import { useAuthReady } from '@/hooks/useAuthReady';

type Room = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  revealAt: string;
  closed?: boolean;
  participants?: string[];
  participantsCount?: number;
};

export default function AdminPage() {
  const { ready, user } = useAuthReady(); // ✅ 로그인 준비 상태 확실히 반영
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminError, setAdminError] = useState<string>('');

  const [roomId, setRoomId] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [awards, setAwards] = useState<{ komangshot?: string; allTimeLegend?: string; playmaker?: string }>({});
  const [msg, setMsg] = useState('');

  // ✅ 어드민 여부 확인 (권한 에러도 잡아서 메시지 표기)
  useEffect(() => {
    const run = async () => {
      setAdminError('');
      setIsAdmin(null);
      if (!ready) return;               // 아직 auth 준비 전 → 로딩 유지
      if (!user) {                      // 로그인 안됨
        setIsAdmin(false);
        setAdminError('로그인이 필요합니다. /login에서 로그인 후 다시 시도하세요.');
        return;
      }
      try {
        const db = getFirestore(firebaseApp);
        const snap = await getDoc(doc(db, 'admins', user.uid));
        setIsAdmin(snap.exists() && !!snap.data()?.isAdmin);
        if (!snap.exists()) {
          setAdminError(
            '어드민 문서가 없습니다. Firebase 콘솔 → Firestore → admins 컬렉션에 내 UID로 문서를 만들고 isAdmin: true(불리언)로 추가하세요.'
          );
        }
      } catch (e: any) {
        // 권한/규칙 문제일 가능성 높음
        setIsAdmin(false);
        setAdminError(
          'admins 컬렉션 읽기 권한이 없습니다. Firestore 규칙에 아래 블록을 추가하고 게시하세요:\n\n' +
          "match /admins/{userId} {\n" +
          "  allow read: if request.auth != null && request.auth.uid == userId;\n" +
          "  allow write: if false;\n" +
          "}\n\n" +
          '그리고 Firebase 콘솔에서 admins/{내UID} 문서에 isAdmin: true(불리언)로 등록했는지 확인하세요.'
        );
      }
    };
    run();
  }, [ready, user]);

  // ✅ roomId 입력 시 방 실시간 구독
  useEffect(() => {
    if (!roomId) { setRoom(null); setChecked({}); setAwards({}); return; }
    const db = getFirestore(firebaseApp);
    const ref = doc(db, 'rooms', roomId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) { setRoom(null); setChecked({}); setAwards({}); return; }
      const data = snap.data() as any;
      setRoom({ id: snap.id, ...data });
      const init: Record<string, boolean> = {};
      (data.participants || []).forEach((u: string) => { init[u] = false; });
      setChecked(init);
    }, (err) => {
      setMsg('❌ 방 구독 에러: ' + (err?.message ?? String(err)));
    });
    return () => unsub();
  }, [roomId]);

  const participants = room?.participants || [];
  const selectedNoshow = useMemo(() => Object.keys(checked).filter(k => checked[k]), [checked]);

  const onCloseRoom = async () => {
    setMsg('방 종료 중...');
    const res = await authedFetch('/api/admin/rooms/close', { method: 'POST', body: JSON.stringify({ roomId }) });
    const j = await res.json();
    setMsg(res.ok ? '✅ 방 종료 완료' : '❌ ' + (j.error || '실패'));
  };

  const onApplyNoshow = async () => {
    setMsg('노쇼 반영 중...');
    const res = await authedFetch('/api/admin/rooms/noshow', { method: 'POST', body: JSON.stringify({ roomId, uids: selectedNoshow }) });
    const j = await res.json();
    setMsg(res.ok ? `✅ 노쇼 ${selectedNoshow.length}명 반영` : '❌ ' + (j.error || '실패'));
  };

  const onAwardTitles = async () => {
    setMsg('칭호 수여 중...');
    const res = await authedFetch('/api/admin/rooms/award-titles', { method: 'POST', body: JSON.stringify({ roomId, awards }) });
    const j = await res.json();
    setMsg(res.ok ? '✅ 칭호 수여 완료' : '❌ ' + (j.error || '실패'));
  };

  // ---------- 렌더링 분기 ----------
  if (!ready) {
    // auth 준비 전 → 이전처럼 "관리자 확인 중…" 한 번만 표시
    return <main style={{ padding: 24 }}>관리자 확인 중…</main>;
  }

  if (!user) {
    // 로그인 안 된 상태
    return (
      <main style={{ padding: 24 }}>
        <h1>어드민 대시보드</h1>
        <p style={{ color:'#c00' }}>로그인이 필요합니다.</p>
        <p><a href="/login">/login</a> 에서 로그인 후 다시 시도하세요.</p>
      </main>
    );
  }

  if (isAdmin === null) {
    // 이 상태가 오래 지속되면 Firestore 접근 문제일 가능성 → 아래 error 안내가 곧 나오도록 처리
    return <main style={{ padding: 24 }}>관리자 확인 중…</main>;
  }

  if (isAdmin === false) {
    // 어드민 문서 없음/권한 에러/일반 사용자
    return (
      <main style={{ padding: 24, maxWidth: 860 }}>
        <h1>어드민 대시보드</h1>
        <p style={{ color:'#c00', whiteSpace:'pre-wrap' }}>
          {adminError || '어드민 권한이 없습니다.'}
        </p>
        <hr style={{ margin:'12px 0' }} />
        <details>
          <summary>디버그 정보 열기</summary>
          <ul style={{ marginTop: 8 }}>
            <li>내 UID: <code>{user.uid}</code></li>
            <li>admins 문서 경로: <code>admins/{user.uid}</code></li>
            <li>확인: Firebase 콘솔 → Firestore → <b>admins</b> 컬렉션에 <b>{user.uid}</b> 문서 생성 후 <b>isAdmin: true (Boolean)</b></li>
            <li>규칙: 위 안내한 <b>read 허용 / write 금지</b> 블록 추가 후 게시</li>
          </ul>
        </details>
      </main>
    );
  }

  // ---- 어드민 OK ----
  return (
    <main style={{ padding: 24, maxWidth: 1000 }}>
      <h1>어드민 대시보드</h1>
      <p style={{ color:'#090' }}>✅ 어드민 확인 완료 (UID: {user.uid})</p>

      <div style={{ marginTop: 12 }}>
        <input placeholder="roomId 입력" value={roomId} onChange={e=>setRoomId(e.target.value)} style={{ width: 360 }} />
      </div>

      {room ? (
        <>
          <section style={{ marginTop: 20 }}>
            <h2>방 정보</h2>
            <p><b>{room.title}</b></p>
            <p>시작: {new Date(room.startAt).toLocaleString()}</p>
            <p>종료: {new Date(room.endAt).toLocaleString()}</p>
            <p>공개: {new Date(room.revealAt).toLocaleString()}</p>
            <p>상태: {room.closed ? '종료됨' : (new Date() >= new Date(room.startAt) ? '모임중/이후' : '준비중')}</p>
            <button onClick={onCloseRoom} disabled={!roomId || room.closed}>방 강제 종료</button>
          </section>

          <section style={{ marginTop: 20 }}>
            <h2>노쇼 처리 (-20점)</h2>
            <p>참여자 목록에서 체크 후 “노쇼 반영”</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:8, marginTop:8 }}>
              {participants.map(uid => (
                <label key={uid} style={{ border:'1px solid #eee', borderRadius:8, padding:8 }}>
                  <input
                    type="checkbox"
                    checked={!!checked[uid]}
                    onChange={e=>setChecked(s=>({ ...s, [uid]: e.target.checked }))}
                  />
                  <span style={{ marginLeft: 8 }}>{uid}</span>
                </label>
              ))}
              {!participants.length && <div>참여자가 없습니다.</div>}
            </div>
            <button onClick={onApplyNoshow} disabled={!selectedNoshow.length} style={{ marginTop: 8 }}>
              노쇼 반영 ({selectedNoshow.length}명)
            </button>
          </section>

          <section style={{ marginTop: 20 }}>
            <h2>칭호 수여 (다음 참여 전까지 표시)</h2>
            <div style={{ display:'grid', gap:8, maxWidth: 520 }}>
              <Select label="코맹샷" value={awards.komangshot || ''} onChange={(v)=>setAwards(s=>({ ...s, komangshot: v }))} options={participants} />
              <Select label="올타임레전드" value={awards.allTimeLegend || ''} onChange={(v)=>setAwards(s=>({ ...s, allTimeLegend: v }))} options={participants} />
              <Select label="플레이메이커" value={awards.playmaker || ''} onChange={(v)=>setAwards(s=>({ ...s, playmaker: v }))} options={participants} />
            </div>
            <button onClick={onAwardTitles} style={{ marginTop: 8 }}>칭호 수여</button>
          </section>
        </>
      ) : (
        <p style={{ marginTop: 16, color:'#666' }}>roomId를 입력하면 정보가 표시됩니다.</p>
      )}

      <p style={{ marginTop: 16 }}>{msg}</p>
    </main>
  );
}

function Select({ label, value, onChange, options }:{
  label:string; value:string; onChange:(v:string)=>void; options:string[];
}) {
  return (
    <label style={{ display:'grid', gap:4 }}>
      <span>{label}</span>
      <select value={value} onChange={e=>onChange(e.target.value)}>
        <option value="">선택 안 함</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
