export type ISODateString = string;

export interface UserDoc {
  uid: string;
  provider: 'kakao' | string;
  name: string;
  nameLower?: string;
  profileImage?: string;
  tempTitles?: string[];
  fcmTokens?: string[];
  lastKakaoSyncAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AdminDoc { isAdmin: boolean; }

export interface RoomDoc {
  title: string;
  titleLower: string;
  type?: string;
  content?: string;
  location: string;
  capacity: number;
  startAt: ISODateString;
  endAt: ISODateString;     // 기본: startAt + 5h
  revealAt: ISODateString;  // 기본: startAt - 1h
  kakaoOpenChatUrl?: string | null;
  creatorUid: string;
  participants: string[];
  participantsCount: number;
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

export const COL = {
  users: 'users',
  admins: 'admins',
  rooms: 'rooms',
  scores: 'scores',
} as const;

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

export function toDateSafe(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
