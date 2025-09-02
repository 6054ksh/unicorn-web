'use client';

import { useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';

export default function FeedbackPage() {
  const [category, setCategory] = useState<'bug'|'idea'|'other'>('idea');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [msg, setMsg] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('보내는 중…');
    try {
      const res = await authedFetch('/api/feedback/submit', {
        method: 'POST',
        body: JSON.stringify({ category, message, contact }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'fail');
      setMsg('✅ 전달 완료! 감사합니다 🙏');
      setMessage('');
      setContact('');
    } catch (e: any) {
      setMsg('❌ ' + (e?.message ?? String(e)));
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 680, margin: '0 auto', background:'#fafbfd' }}>
      <h1 style={{ fontWeight: 900, marginBottom: 8 }}>방명록 & 피드백</h1>
      <p style={{ color:'#475569', marginBottom: 18 }}>
        사용 중 불편한 점이나 개선 아이디어를 자유롭게 남겨주세요. (익명/로그인 모두 가능)
      </p>

      <form onSubmit={onSubmit} style={{ display:'grid', gap: 12, background:'#fff', border:'1px solid #e6ebf3', borderRadius: 14, padding: 14 }}>
        <label style={{ display:'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color:'#0f172a' }}>분류</span>
          <select value={category} onChange={e=>setCategory(e.target.value as any)} style={input}>
            <option value="idea">개선 아이디어</option>
            <option value="bug">버그/오류 제보</option>
            <option value="other">기타</option>
          </select>
        </label>

        <label style={{ display:'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color:'#0f172a' }}>내용</span>
          <textarea
            value={message}
            onChange={e=>setMessage(e.target.value)}
            placeholder="자유롭게 작성해주세요 (5자 이상)"
            rows={6}
            required
            style={{ ...input, resize:'vertical' }}
          />
        </label>

        <label style={{ display:'grid', gap: 6 }}>
          <span style={{ fontWeight: 700, color:'#0f172a' }}>연락처(선택)</span>
          <input
            value={contact}
            onChange={e=>setContact(e.target.value)}
            placeholder="카톡 ID 또는 이메일"
            style={input}
          />
        </label>

        <button
          type="submit"
          style={{ padding:'10px 14px', background:'#2563eb', color:'#fff', borderRadius: 10, border:'1px solid #1d4ed8', fontWeight:800 }}
        >
          보내기
        </button>
        {msg && <p style={{ color: msg.startsWith('✅') ? '#15803d' : '#dc2626' }}>{msg}</p>}
      </form>
    </main>
  );
}

const input: React.CSSProperties = {
  border: '1px solid #dbeafe',
  borderRadius: 10,
  padding: '10px 12px',
  background: '#f8fafc',
  color: '#0f172a'
};
