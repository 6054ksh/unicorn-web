'use client';

import { useEffect, useMemo, useState } from 'react';
import { firebaseApp } from '@/lib/firebase';
import {
  getFirestore, collection, onSnapshot, query, orderBy,
  where, documentId, getDocs
} from 'firebase/firestore';

type ScoreRow = {
  uid: string;
  total: number;
  createdRooms?: number;
  joinedRooms?: number;
  lastUpdatedAt?: string;
};

type UserRow = {
  uid: string;
  name?: string;
  profileImage?: string;
  tempTitles?: string[]; // ✅ 다음 참여 전까지 표시
};

export default function ScoresPage() {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});

  useEffect(() => {
    const db = getFirestore(firebaseApp);
    const q = query(collection(db, 'scores'), orderBy('total', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: ScoreRow[] = [];
      snap.forEach(d => {
        const v = d.data() as any;
        arr.push({
          uid: d.id,
          total: v.total || 0,
          createdRooms: v.createdRooms || 0,
          joinedRooms: v.joinedRooms || 0,
          lastUpdatedAt: v.lastUpdatedAt || '',
        });
      });
      setScores(arr);
    });
    return () => unsub();
  }, []);

  // 점수 목록이 갱신될 때마다 users 이름/프로필/임시 칭호 가져오기
  useEffect(() => {
    (async () => {
      const uids = scores.map(s => s.uid);
      if (!uids.length) { setUsers({}); return; }

      const db = getFirestore(firebaseApp);
      const usersCol = collection(db, 'users');

      const chunks: string[][] = [];
      for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));

      const map: Record<string, UserRow> = {};
      for (const g of chunks) {
        const q = query(usersCol, where(documentId(), 'in', g));
        const snap = await getDocs(q);
        snap.forEach(d => {
          const x = d.data() as any;
          map[d.id] = {
            uid: d.id,
            name: x?.name || '(이름없음)',
            profileImage: x?.profileImage || '',
            tempTitles: Array.isArray(x?.tempTitles) ? x.tempTitles : [],
          };
        });
      }
      setUsers(map);
    })();
  }, [scores]);

  const rows = useMemo(() => scores.map((s, i) => ({
    rank: i + 1,
    ...s,
    name: users[s.uid]?.name || s.uid,
    profileImage: users[s.uid]?.profileImage || '',
    tempTitles: users[s.uid]?.tempTitles || [],
  })), [scores, users]);

  return (
    <main style={{ padding: 24 }}>
      <h1>점수판</h1>
      <p style={{ opacity: .7, marginBottom: 8 }}>
        ※ 실시간 반영. (개설: +30/정원≥8: +40, 참여: +5, 나가기:-5, 노쇼:-20)
      </p>

      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', minWidth: 740 }}>
          <thead>
            <tr>
              <th style={th}>순위</th>
              <th style={th}>이름</th>
              <th style={th}>칩</th>
              <th style={th}>총점</th>
              <th style={th}>개설 수</th>
              <th style={th}>참여 수</th>
              <th style={th}>최근 갱신</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.uid}>
                <td style={tdCenter}>{r.rank}</td>
                <td style={tdLeft}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {r.profileImage ? (
                      <img src={r.profileImage} alt={r.name} style={{ width:24, height:24, borderRadius:'50%' }} />
                    ) : (
                      <div style={{
                        width:24, height:24, borderRadius:'50%', background:'#eee',
                        display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11
                      }}>?</div>
                    )}
                    <span>{r.name}</span>
                  </div>
                </td>
                <td style={tdLeft}>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {r.tempTitles?.map(t => (
                      <span key={t} style={badge}>{t}</span>
                    ))}
                  </div>
                </td>
                <td style={tdRight}><b>{r.total}</b></td>
                <td style={tdRight}>{r.createdRooms ?? 0}</td>
                <td style={tdRight}>{r.joinedRooms ?? 0}</td>
                <td style={tdLeft}>{r.lastUpdatedAt ? new Date(r.lastUpdatedAt).toLocaleString() : '-'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} style={{ padding: 16, textAlign:'center', color:'#666' }}>아직 점수가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #ddd', whiteSpace:'nowrap'
};
const tdLeft: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', whiteSpace:'nowrap'
};
const tdRight: React.CSSProperties = {
  textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', whiteSpace:'nowrap'
};
const tdCenter: React.CSSProperties = {
  textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', whiteSpace:'nowrap'
};
const badge: React.CSSProperties = {
  display:'inline-block', padding:'2px 6px', borderRadius:999, border:'1px solid #ddd', fontSize:12, background:'#fafafa'
};
