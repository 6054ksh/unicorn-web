'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { firebaseApp } from '@/lib/firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, query, orderBy, limit as fsLimit,
  onSnapshot, doc, getDoc, getDocs, where, documentId
} from 'firebase/firestore';
import { authedFetch } from '@/lib/authedFetch';

type Noti = {
  id: string;
  type?: string;     // 'vote-request' | 'room-created' | 'joined' | 'under-min-closed' 등
  title?: string;
  body?: string;
  url?: string;
  unread?: boolean;
  createdAt?: string; // ISO
  roomId?: string;    // vote-request 등에 필요
};

type RoomDoc = {
  id: string;
  title: string;
  participants?: string[];
};

type UserMeta = { uid: string; name?: string; profileImage?: string };

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [notis, setNotis] = useState<Noti[]>([]);
  const [loading, setLoading] = useState(true);

  const auth = useMemo(() => getAuth(firebaseApp), []);
  const db = useMemo(() => getFirestore(firebaseApp), []);
  const unsubRef = useRef<null | (() => void)>(null);

  // 투표폼용 캐시: roomId -> { room, users }
  const [roomCache, setRoomCache] = useState<Record<string, { room: RoomDoc; users: Record<string, UserMeta> }>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    setNotis([]);
    setLoading(true);
    if (!uid) { setLoading(false); return; }

    const col = collection(db, 'users', uid, 'notifications');
    const qy = query(col, orderBy('createdAt', 'desc'), fsLimit(50));
    const unsub = onSnapshot(qy, (snap) => {
      const arr: Noti[] = [];
      snap.forEach(d => {
        const v = d.data() as any;
        arr.push({
          id: d.id,
          type: v?.type,
          title: v?.title,
          body: v?.body,
          url: v?.url,
          unread: v?.unread ?? true,
          createdAt: v?.createdAt,
          roomId: v?.roomId,
        });
      });
      setNotis(arr);
      setLoading(false);
    });
    unsubRef.current = unsub;
    return () => { if (unsubRef.current) unsubRef.current(); unsubRef.current = null; };
  }, [db, uid]);

  // roomId가 있는 vote-request 알림이 보이면, 그 방과 참가자 "이름"을 캐시
  useEffect(() => {
    (async () => {
      const targets = notis.filter(n => n.type === 'vote-request' && n.roomId && !roomCache[n.roomId]);
      if (!targets.length) return;

      const newCache: Record<string, { room: RoomDoc; users: Record<string, UserMeta> }> = {};
      for (const n of targets) {
        const roomId = n.roomId!;
        // room doc
        const rSnap = await getDoc(doc(db, 'rooms', roomId));
        if (!rSnap.exists()) continue;
        const rv = rSnap.data() as any;
        const room: RoomDoc = { id: rSnap.id, title: rv?.title || '(제목없음)', participants: Array.isArray(rv?.participants) ? rv.participants : [] };

        // fetch users meta by chunks
        const ids = room.participants || [];
        const usersMap: Record<string, UserMeta> = {};
        for (let i = 0; i < ids.length; i += 10) {
          const chunk = ids.slice(i, i + 10);
          const uQ = query(collection(db, 'users'), where(documentId(), 'in', chunk));
          const uS = await getDocs(uQ);
          uS.forEach(d => {
            const vv = d.data() as any;
            usersMap[d.id] = {
              uid: d.id,
              name: vv?.name || '(이름없음)',
              profileImage: vv?.profileImage || '',
            };
          });
        }

        newCache[roomId] = { room, users: usersMap };
      }
      if (Object.keys(newCache).length) {
        setRoomCache(prev => ({ ...prev, ...newCache }));
      }
    })();
  }, [db, notis, roomCache]);

  const unreadCount = notis.filter(n => n.unread !== false).length;

  const ack = async (notifId: string, action: 'delete' | 'read' = 'delete') => {
    await authedFetch('/api/me/notifications/ack', {
      method: 'POST',
      body: JSON.stringify({ notifId, action }),
    });
  };

  // 투표 제출
  const submitVote = async (notif: Noti, thumbsForUid: string | '', heartForUid: string | '', noshowUid: string | 'none') => {
    if (!notif.roomId) return;
    try {
      const res = await authedFetch('/api/rooms/vote', {
        method: 'POST',
        body: JSON.stringify({
          roomId: notif.roomId,
          thumbsForUid: thumbsForUid || null,
          heartForUid: heartForUid || null,
          noshowUid: noshowUid || 'none',
        }),
      });
      // 이미 투표했으면 409가 올 수 있음 → 폼은 숨기고 알림은 정리
      if (!res.ok && res.status !== 409) {
        const j = await res.json().catch(() => ({}));
        alert('투표 실패: ' + (j?.error || res.statusText));
        return;
      }
      await ack(notif.id, 'delete'); // 제출되면 알림 제거
    } catch (e: any) {
      alert('투표 실패: ' + (e?.message ?? String(e)));
    }
  };

  const VoteCard: React.FC<{ n: Noti }> = ({ n }) => {
    const [thumbs, setThumbs] = useState('');
    const [heart, setHeart] = useState('');
    const [noshow, setNoshow] = useState<'none' | string>('none');

    const info = n.roomId ? roomCache[n.roomId] : undefined;
    const nameOf = (u: string) => info?.users[u]?.name || u; // 항상 이름 우선, 없으면 UID

    return (
      <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, background: '#fff' }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>{info?.room?.title || n.title || '모임 투표'}</div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
          {n.body || '참여했던 모임! 따봉/하트/노쇼를 한 번만 투표할 수 있어요.'}
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span>👍 따봉 줄 사람</span>
            <select value={thumbs} onChange={e => setThumbs(e.target.value)}>
              <option value="">선택 안 함</option>
              {(info?.room?.participants || []).map(u => (
                <option key={u} value={u}>{nameOf(u)}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span>❤️ 하트 줄 사람</span>
            <select value={heart} onChange={e => setHeart(e.target.value)}>
              <option value="">선택 안 함</option>
              {(info?.room?.participants || []).map(u => (
                <option key={u} value={u}>{nameOf(u)}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: 4 }}>
            <span>🚫 노쇼 투표</span>
            <select value={noshow} onChange={e => setNoshow(e.target.value as any)}>
              <option value="none">노쇼자 없음</option>
              {(info?.room?.participants || []).map(u => (
                <option key={u} value={u}>{nameOf(u)}</option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => submitVote(n, thumbs, heart, noshow)}
              style={{ padding: '8px 12px', borderRadius: 8, background: '#111', color: '#fff' }}
              disabled={!info}
              title={!info ? '참여자 정보를 불러오는 중이에요' : '제출하면 알림이 사라져요'}
            >
              투표 제출
            </button>
            <button
              onClick={() => ack(n.id, 'delete')}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd' }}
              title="알림 숨기기"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  };

  const Item: React.FC<{ n: Noti }> = ({ n }) => {
    if (n.type === 'vote-request') return <VoteCard n={n} />;

    // 일반 알림 카드
    return (
      <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, background: '#fff' }}>
        <div style={{ fontWeight: 800 }}>{n.title || '알림'}</div>
        {n.body ? <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{n.body}</div> : null}
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          {n.url ? (
            <a href={n.url} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', textDecoration: 'none' }}>
              열어보기
            </a>
          ) : null}
          <button onClick={() => ack(n.id, 'delete')} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd' }}>
            닫기
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 좌하단 토글 버튼 */}
      <div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 50 }}>
        <button
          onClick={() => setOpen(s => !s)}
          style={{
            width: 52, height: 52, borderRadius: 999, border: '1px solid #eee',
            background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.08)', position: 'relative'
          }}
          aria-label="알림"
          title="알림"
        >
          {/* Bell icon */}
          <span style={{ fontSize: 24 }}>🔔</span>
          {/* 배지 */}
          {uid && unreadCount > 0 ? (
            <span style={{
              position: 'absolute', right: -4, top: -4, background: '#ef4444', color: '#fff',
              fontSize: 12, borderRadius: 999, padding: '2px 6px', border: '2px solid #fff'
            }}>
              {unreadCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* 패널 */}
      {open && (
        <div
          style={{
            position: 'fixed', left: 16, bottom: 80, width: 360, maxWidth: 'calc(100vw - 32px)',
            maxHeight: '60vh', overflow: 'auto', background: '#f8fafc', border: '1px solid #e5e7eb',
            borderRadius: 12, padding: 12, boxShadow: '0 16px 40px rgba(0,0,0,.12)', zIndex: 50
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <b>알림</b>
            <button onClick={() => setOpen(false)} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '4px 8px' }}>
              닫기
            </button>
          </div>

          {!uid ? (
            <div style={{ color: '#666', fontSize: 13 }}>로그인 후 알림을 확인할 수 있어요.</div>
          ) : loading ? (
            <div style={{ color: '#666', fontSize: 13 }}>불러오는 중…</div>
          ) : notis.length === 0 ? (
            <div style={{ color: '#666', fontSize: 13 }}>새 알림이 없어요.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {/* 투표 알림 우선 정렬: type === 'vote-request' 먼저 나오게 */}
              {notis
                .slice()
                .sort((a, b) => (a.type === 'vote-request' ? -1 : 0) - (b.type === 'vote-request' ? -1 : 0))
                .map(n => <Item key={n.id} n={n} />)}
            </div>
          )}
        </div>
      )}
    </>
  );
}
