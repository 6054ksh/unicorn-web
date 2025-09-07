'use client';

import React, { useEffect, useState } from 'react';
import { firebaseApp } from '@/lib/firebase';
import { getFirestore, collection, getDocs, query, where, documentId } from 'firebase/firestore';

type Props = { uids: string[] };
type UserMeta = { uid: string; name?: string; profileImage?: string };

export default function ParticipantsClient({ uids }: Props) {
  const [users, setUsers] = useState<Record<string, UserMeta>>({});

  useEffect(() => {
    (async () => {
      if (!uids?.length) { setUsers({}); return; }
      const db = getFirestore(firebaseApp);
      const map: Record<string, UserMeta> = {};
      for (let i = 0; i < uids.length; i += 10) {
        const chunk = uids.slice(i, i + 10);
        const qy = query(collection(db, 'users'), where(documentId(), 'in', chunk));
        const snap = await getDocs(qy);
        snap.forEach(d => {
          const v = d.data() as any;
          map[d.id] = {
            uid: d.id,
            name: v?.name || '(이름없음)',
            profileImage: v?.profileImage || '',
          };
        });
      }
      setUsers(map);
    })();
  }, [uids]);

  if (!uids?.length) return <div style={{ color:'#666' }}>아직 참여자가 없어요.</div>;

  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {uids.map(u => {
        const x = users[u];
        return (
          <div key={u} style={{
            border:'1px solid #eee', borderRadius:999, padding:'4px 8px',
            display:'inline-flex', alignItems:'center', gap:6, background:'#fff'
          }}>
            {x?.profileImage ? (
              <img src={x.profileImage} alt={x?.name || u} style={{ width:22, height:22, borderRadius:'50%' }} />
            ) : (
              <div style={{
                width:22, height:22, borderRadius:'50%', background:'#f1f5f9',
                display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#64748b'
              }}>?</div>
            )}
            <span style={{ fontSize:13 }}>{x?.name || u}</span>
          </div>
        );
      })}
    </div>
  );
}
