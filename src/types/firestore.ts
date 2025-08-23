// src/types/firestore.ts
export type ISODateString = string; // ex) "2025-08-25T03:00:00.000Z"

export interface UserDoc {
  uid: string;
  provider: 'kakao' | string;
  name: string;
  nameLower?: string;
  profileImage?: string;
  tempTitles?: string[];     // 임시 칭호 (다음 참여 전까지)
  fcmTokens?: string[];      // 웹푸시 토큰들
  lastKakaoSyncAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AdminDoc {
  isAdmin: boolean;
}

export interface RoomDoc {
  title: string;
  titleLower: string;
  type?: string;
  content?: string;

  location: string;
  capacity: number;

  startAt: ISODateString;
  endAt: ISODateString;      // 기본: startAt + 5h (서버에서 자동세팅 권장)
  revealAt: ISODateString;   // 기본: startAt - 1h

  kakaoOpenChatUrl?: string | null;
  creatorUid: string;

  participants: string[];    // uid[]
  participantsCount: number; // 파생 캐시
  closed: boolean;

  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ScoreDoc {
  total: number;
  createdRooms?: number;
  joinedRooms?: number;
  lastUpdatedAt?: ISODateString;
}

// ---- 컬렉션 경로 상수 ----
export const COL = {
  users: 'users',
  admins: 'admins',
  rooms: 'rooms',
  scores: 'scores',
} as const;

// ---- 유틸: 상태 계산 ----
export type RoomState = 'preparing' | 'ongoing' | 'ended' | 'closed';

export function getRoomState(room: Pick<RoomDoc, 'startAt'|'endAt'|'closed'>): RoomState {
  if (room.closed) return 'closed';
  const now = Date.now();
  const s = Date.parse(room.startAt);
  const e = Date.parse(room.endAt);
  if (Number.isNaN(s) || Number.isNaN(e)) return 'preparing';
  if (now < s) return 'preparing';
  if (now >= e) return 'ended';
  return 'ongoing';
}

// ---- 유틸: 안전 날짜 ----
export function toDateSafe(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
