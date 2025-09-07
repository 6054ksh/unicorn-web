'use client';

import { useEffect, useMemo, useState } from 'react';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit as fsLimit,
  updateDoc,
  doc
} from 'firebase/firestore';

type Noti = {
  id: string;
  type: 'vote'|'info';
  title: string;
  body?: string;
  url?: string;
  createdAt?: string;
  read?: boolean;
  pinned?: boolean;
  roomId?: string;
};

export default function NotifyBell() {
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<Noti[]>([]);

  const auth = useMemo(() => getAuth(firebaseApp), []);
  const db = useMemo(() => getFirestore(firebaseApp), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!uid) { setItems([]); return; }
    const ref = collection(db, 'notifications', uid, 'items');
    const qy = query(ref, orderBy('pinned', 'desc'), orderBy('createdAt', 'desc'), fsLimit(50));
    const unsub = onSnapshot(qy, (snap) => {
      const arr: Noti[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      setItems(arr);
    });
    return () => unsub();
  }, [db, uid]);

  const unread = useMemo(() => items.filter(i => !i.read).length, [items]);
  const voteTop = useMemo(() => items.filter(i => i.type === 'vote'), [items]);
  const others = useMemo(() => items.filter(i => i.type !== 'vote'), [items]);

  const onOpen = async () => {
    setOpen((o) => !o);
    if (!open && uid) {
      // 열 때 읽음 처리(상단 20개만)
      const top = items.slice(0, 20).filter(i => !i.read);
      top.forEach(async (n) => {
        await updateDoc(doc(db, 'notifications', uid!, 'items', n.id), { read: true });
      });
    }
  };

  // 스타일
  const bellBase: React.CSSProperties = {
    position: 'fixed', top: 20, left: 16, zIndex: 60,
    width: 40, height: 40, borderRadius: 12,
    background: unread ? '#FEE2E2' : '#F3F4F6',
    border: '1px solid #E5E7EB', boxShadow: '0 6px 16px rgba(0,0,0,.08)',
    display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'
  };
  const badge: React.CSSProperties = {
    position:'absolute', top:-6, right:-6,
    minWidth:18, height:18, borderRadius:999, background:'#EF4444', color:'#fff',
    border:'2px solid #fff', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px'
  };
  const panel: React.CSSProperties = {
    position:'fixed', top:0, left:0, bottom:0, width: 320, background:'#fff',
    borderRight:'1px solid #e5e7eb', zIndex: 59, boxShadow:'4px 0 16px rgba(0,0,0,.06)', padding:'16px 12px', overflow:'auto'
  };

  return (
    <>
      {/* 종 버튼 */}
      <button aria-label="알림" onClick={onOpen} style={bellBase} title={unread ? `새 알림 ${unread}개` : '알림'}>
        {/* 심플한 벨 아이콘 (흑백/컬러) */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill={unread ? '#EF4444' : 'none'} stroke="#111" strokeWidth="1.6">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6 6 0 1 0-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread ? <span style={badge}>{unread}</span> : null}
      </button>

      {/* 패널 */}
      {open && (
        <aside style={panel}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ margin:0, fontSize:16, fontWeight:900 }}>알림</h3>
            <button onClick={()=>setOpen(false)} style={{ padding:'6px 8px', borderRadius:8, border:'1px solid #ddd' }}>닫기</button>
          </div>

          {/* 투표 알림을 최상단 섹션으로 */}
          {voteTop.length ? (
            <div style={{ marginTop:12, padding:10, border:'1px dashed #e5e7eb', borderRadius:12, background:'#FFFBEB' }}>
              <div style={{ fontWeight:800, color:'#92400E', marginBottom:6 }}>🗳️ 투표 알림</div>
              <div style={{ display:'grid', gap:8 }}>
                {voteTop.map(n => (
                  <a key={n.id} href={n.url || (n.roomId ? `/room/${n.roomId}` : '#')} style={{ textDecoration:'none', color:'#111', border:'1px solid #f3e8ff', padding:8, borderRadius:10, background:'#fff' }}>
                    <div style={{ fontWeight:700 }}>{n.title}</div>
                    {n.body ? <div style={{ fontSize:12, color:'#555' }}>{n.body}</div> : null}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {/* 그 외 알림 */}
          <div style={{ marginTop:12 }}>
            <div style={{ fontWeight:800, marginBottom:6 }}>최근 알림</div>
            {others.length ? (
              <div style={{ display:'grid', gap:8 }}>
                {others.map(n => (
                  <a key={n.id} href={n.url || '#'} style={{ textDecoration:'none', color:'#111', border:'1px solid #eee', padding:8, borderRadius:10 }}>
                    <div style={{ fontWeight:700 }}>{n.title}</div>
                    {n.body ? <div style={{ fontSize:12, color:'#555' }}>{n.body}</div> : null}
                    {n.createdAt ? <div style={{ fontSize:11, color:'#888', marginTop:4 }}>{new Date(n.createdAt).toLocaleString()}</div> : null}
                  </a>
                ))}
              </div>
            ) : <div style={{ color:'#777', fontSize:13 }}>새 알림이 없어요. 🙂</div>}
          </div>
        </aside>
      )}
    </>
  );
}
