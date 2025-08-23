// src/app/scores/page.tsx
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = {
  uid: string;
  name: string;
  profileImage?: string;
  tempTitles?: string[];
  total: number;
  createdRooms?: number;
  joinedRooms?: number;
  lastUpdatedAt?: string;
};

async function fetchScores(): Promise<{ users: Row[] }> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://unicorn-web-git-main-6054kshs-projects.vercel.app';
  const res = await fetch(`${base}/api/scores?limit=50`, { cache: 'no-store' });
  if (!res.ok) return { users: [] };
  return res.json();
}

export default async function ScoresPage() {
  const { users } = await fetchScores();

  return (
    <main style={{ padding: 24 }}>
      <h1>점수판</h1>
      <p style={{ opacity: .7, marginBottom: 8 }}>
        ※ 실시간(새로고침 기준) 반영. (개설:+30 / 정원≥8:+40 / 참여:+5 / 나가기:-5 / 노쇼:-20)
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
            {users.map((u, i) => (
              <tr key={u.uid}>
                <td style={tdCenter}>{i + 1}</td>
                <td style={tdLeft}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {u.profileImage ? (
                      <img src={u.profileImage} alt="" style={{ width:24, height:24, borderRadius:'50%' }} />
                    ) : (
                      <div style={{ width:24, height:24, borderRadius:'50%', background:'#eee',
                        display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>?</div>
                    )}
                    <span>{u.name}</span>
                  </div>
                </td>
                <td style={tdLeft}>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {(u.tempTitles || []).map((t) => (
                      <span key={t} style={badge}>{t}</span>
                    ))}
                  </div>
                </td>
                <td style={tdRight}><b>{u.total}</b></td>
                <td style={tdRight}>{u.createdRooms ?? 0}</td>
                <td style={tdRight}>{u.joinedRooms ?? 0}</td>
                <td style={tdLeft}>{u.lastUpdatedAt ? new Date(u.lastUpdatedAt).toLocaleString() : '-'}</td>
              </tr>
            ))}
            {!users.length && (
              <tr><td colSpan={7} style={{ padding: 16, textAlign:'center', color:'#666' }}>아직 점수가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #ddd', whiteSpace:'nowrap' };
const tdLeft: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', whiteSpace:'nowrap' };
const tdRight: React.CSSProperties = { textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', whiteSpace:'nowrap' };
const tdCenter: React.CSSProperties = { textAlign: 'center', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', whiteSpace:'nowrap' };
const badge: React.CSSProperties = { display:'inline-block', padding:'2px 6px', borderRadius:999, border:'1px solid #ddd', fontSize:12, background:'#fafafa' };
