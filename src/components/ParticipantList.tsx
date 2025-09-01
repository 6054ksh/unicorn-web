'use client';

import { useEffect, useState } from 'react';
import { firebaseApp } from '@/lib/firebase';
import { getFirestore, collection, query, where, getDocs, documentId } from 'firebase/firestore';

type Props = { participants: string[]; revealAt?: string };

export default function ParticipantList({ participants, revealAt }: Props) {
  const [users, setUsers] = useState<Record<string, { name: string; profileImage?: string }>>({});
  const canReveal = revealAt ? new Date() >= new Date(revealAt) : false;

  useEffect(() => {
    if (!participants?.length || !canReveal) { setUsers({}); return; }
    (async () => {
      const db = getFirestore(firebaseApp);
      const map: any = {};
      for (let i=0;i<participants.length;i+=10) {
        const g = participants.slice(i, i+10);
        const qy = query(collection(db, 'users'), where(documentId(), 'in', g));
        const snap = await getDocs(qy);
        snap.forEach(d => {
          const v = d.data() as any;
          map[d.id] = { name: v?.name || '(이름없음)', profileImage: v?.profileImage || '' };
        });
      }
      setUsers(map);
    })();
  }, [participants, canReveal]);

  if (!canReveal) return (
    <div style={{ fontSize:12, color:'#666' }}>
      모임 시작 1시간 전부터 참가자 목록이 공개됩니다.
    </div>
  );
  if (!participants?.length) return <div>참가자가 아직 없습니다.</div>;

  return (
    <div style={{ display:'grid', gap:6 }}>
      {participants.map(uid => (
        <div key={uid} style={{ display:'flex', alignItems:'center', gap:8 }}>
          {users[uid]?.profileImage ? (
            <img src={users[uid]!.profileImage} alt={users[uid]!.name} style={{ width:22, height:22, borderRadius:'50%' }} />
          ) : (
            <div style={{ width:22, height:22, borderRadius:'50%', background:'#eee',
              display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>?</div>
          )}
          <span>{users[uid]?.name || uid}</span>
        </div>
      ))}
    </div>
  );
}
