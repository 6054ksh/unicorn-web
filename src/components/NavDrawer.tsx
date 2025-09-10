'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NavDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, []);

  const Item = ({ href, label, emoji }: { href: string; label: string; emoji: string }) => (
    <Link href={href} onClick={() => setOpen(false)} style={{
      display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
      borderRadius:12, textDecoration:'none', color:'#111', border:'1px solid #eee', background:'#fff'
    }}>
      <span style={{ fontSize:18 }}>{emoji}</span>
      <span style={{ fontWeight:700 }}>{label}</span>
    </Link>
  );

  return (
    <>
      {/* 햄버거 버튼 (좌상단) */}
      <button
        aria-label="메뉴 열기"
        onClick={() => setOpen(true)}
        style={{
          position:'fixed', left:12, top:12, zIndex:1100,
          width:40, height:40, borderRadius:12,
          background:'#fff', border:'1px solid #e5e7eb', boxShadow:'0 4px 12px rgba(0,0,0,.08)',
          cursor:'pointer'
        }}
      >
        ☰
      </button>

      {/* 홈 버튼 (우상단) */}
      <Link
        href="/"
        style={{
          position:'fixed', right:12, top:12, zIndex:1100,
          width:40, height:40, borderRadius:12, display:'grid', placeItems:'center',
          background:'#fff', border:'1px solid #e5e7eb', boxShadow:'0 4px 12px rgba(0,0,0,.08)', color:'#111', textDecoration:'none', fontWeight:800
        }}
        aria-label="홈으로"
      >
        ⌂
      </Link>

      {/* 사이드 드로어 */}
      <div
        role="dialog"
        aria-hidden={!open}
        style={{
          position:'fixed', inset:0, zIndex:1099, pointerEvents: open ? 'auto' : 'none'
        }}
        onClick={() => setOpen(false)}
      >
        {/* Dim */}
        <div style={{
          position:'absolute', inset:0, background:'rgba(0,0,0,.28)',
          opacity: open ? 1 : 0, transition:'opacity .18s ease'
        }}/>

        {/* Panel */}
        <aside
          onClick={(e) => e.stopPropagation()}
          style={{
            position:'absolute', left:0, top:0, bottom:0, width:260,
            transform: open ? 'translateX(0)' : 'translateX(-100%)',
            transition:'transform .18s ease',
            background:'#f8fafc', borderRight:'1px solid #e5e7eb', padding:14,
            display:'grid', gap:10
          }}
        >
          <div style={{ fontWeight:900, fontSize:16, marginBottom:6 }}>UNIcorn</div>
          <Item href="/" label="홈" emoji="🏠" />
          <Item href="/room" label="모임 목록" emoji="🗓️" />
          <Item href="/create" label="모임 만들기" emoji="🎉" />
          <Item href="/scores" label="점수판" emoji="🏆" />
        </aside>
      </div>
    </>
  );
}
