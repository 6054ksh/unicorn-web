'use client';

export default function HomeNav() {
  return (
    <nav style={wrap}>
      <a href="/" style={link}>홈</a>
      <a href="/room" style={link}>모임목록</a>
      <a href="/room/new" style={link}>모임만들기</a>
      <a href="/scores" style={link}>점수판</a>
      <a href="/notifications/enable" style={link}>알림설정</a>
      <a href="/me" style={link}>내정보</a>
    </nav>
  );
}
const wrap: React.CSSProperties = {
  position:'sticky', top:0, zIndex:10, display:'flex', gap:8, padding:'10px 12px',
  background:'#111', color:'#fff', overflowX:'auto'
};
const link: React.CSSProperties = {
  color:'#fff', textDecoration:'none', padding:'6px 10px', border:'1px solid #333', borderRadius:8
};
