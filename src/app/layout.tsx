// src/app/layout.tsx
import Link from 'next/link';
import FcmRegistrar from '@/components/FcmRegistrar';

export const metadata = {
  title: 'UNIcorn 🦄',
  description: 'UNI 학생회 모임 앱',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ background:'#fafafa', color:'#111', margin:0 }}>
        <header style={{
          position:'sticky', top:0, zIndex:50,
          backdropFilter:'saturate(180%) blur(10px)',
          background:'rgba(255,255,255,0.85)',
          borderBottom:'1px solid #eee'
        }}>
          <nav style={{
            maxWidth:1100, margin:'0 auto',
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'10px 16px'
          }}>
            <Link href="/" style={{ textDecoration:'none', color:'#111', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18, fontWeight:800 }}>UNIcorn 🦄</span>
            </Link>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <Link href="/room" style={navLink}>모임목록</Link>
              <Link href="/room/new" style={navLink}>방 만들기</Link>
              <Link href="/scores" style={navLink}>점수판</Link>
              <Link href="/me" style={navLink}>내정보</Link>
            </div>
          </nav>
        </header>

        {/* FCM 토큰 등록기 (숨김 컴포넌트) */}
        <FcmRegistrar />

        <main style={{ maxWidth:1100, margin:'0 auto' }}>
          {children}
        </main>

        <footer style={{ textAlign:'center', color:'#888', fontSize:12, padding:'24px 0' }}>
          © {new Date().getFullYear()} UNIcorn
        </footer>
      </body>
    </html>
  );
}

const navLink: React.CSSProperties = {
  padding:'6px 10px', borderRadius:8, border:'1px solid #eee', background:'#fff',
  textDecoration:'none', color:'#111'
};
