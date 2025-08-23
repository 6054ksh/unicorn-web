'use client';

import { useEffect, useState } from 'react';

export default function AddToHomePrompt() {
  const [androidEvt, setAndroidEvt] = useState<any>(null);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isInStandalone = (window.matchMedia('(display-mode: standalone)').matches) || ((window as any).navigator?.standalone);

    if (isIOS && !isInStandalone) {
      setShowIOS(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setAndroidEvt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (androidEvt) {
    return (
      <div style={wrap}>
        <div style={box}>
          <b>앱으로 설치하면 알림이 더 안정적이에요.</b>
          <div style={{marginTop:8}}>
            <button onClick={async () => { await androidEvt.prompt(); setAndroidEvt(null); }}>설치하기</button>
            <button onClick={() => setAndroidEvt(null)} style={{marginLeft:8}}>나중에</button>
          </div>
        </div>
      </div>
    );
  }

  if (showIOS) {
    return (
      <div style={wrap}>
        <div style={box}>
          <b>iOS: 홈 화면에 추가하면 푸시 수신이 더 안정적입니다.</b>
          <div style={{ fontSize:12, color:'#555', marginTop:6 }}>
            Safari 하단 공유버튼 → “홈 화면에 추가”
          </div>
          <div style={{marginTop:8}}>
            <button onClick={() => setShowIOS(false)}>알겠어요</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const wrap: React.CSSProperties = {
  position:'fixed', left:0, right:0, bottom:12, display:'flex', justifyContent:'center', pointerEvents:'none', zIndex:1000
};
const box: React.CSSProperties = {
  pointerEvents:'auto', background:'#111', color:'#fff', padding:12, borderRadius:12, boxShadow:'0 6px 20px rgba(0,0,0,.2)'
};
