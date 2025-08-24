'use client';
import { useEffect, useRef, useState } from 'react';
import { firebaseApp } from '@/lib/firebase';
import { getFirestore, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export default function RoomRealtimeToast() {
  const [room, setRoom] = useState<{ id:string; title:string } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const db = getFirestore(firebaseApp);
    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      const doc = snap.docs[0];
      if (!doc) return;
      const v = doc.data() as any;
      if (first.current) { // 첫 로드에서는 토스트 안 띄움
        first.current = false; 
        return;
      }
      setRoom({ id: doc.id, title: v?.title || '(무제)' });
      try { navigator.vibrate?.(30); } catch {}
    });
    return () => unsub();
  }, []);

  if (!room) return null;
  return (
    <div style={wrap}>
      <div style={box}>
        <div style={{fontWeight:700, marginBottom:6}}>새 모임이 올라왔어요 🎉</div>
        <div style={{marginBottom:10}}>{room.title}</div>
        <div style={{display:'flex', gap:8}}>
          <a href={`/room/${room.id}`} style={btnPrimary}>보러가기</a>
          <button onClick={()=>setRoom(null)} style={btn}>닫기</button>
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { position:'fixed', left:0, right:0, bottom:16, display:'flex', justifyContent:'center', zIndex:1000 };
const box: React.CSSProperties  = { background:'#111', color:'#fff', padding:12, borderRadius:12, boxShadow:'0 6px 20px rgba(0,0,0,.2)', maxWidth:360, width:'calc(100% - 24px)' };
const btn: React.CSSProperties  = { padding:'6px 10px', borderRadius:8, border:'1px solid #555', background:'#222', color:'#fff', cursor:'pointer' };
const btnPrimary: React.CSSProperties  = { ...btn, background:'#3b82f6', border:'1px solid #2563eb', textDecoration:'none' };
