export const COL = {
  users: 'users',
  rooms: 'rooms',
  scores: 'scores',
  admins: 'admins',
  roomVotes: 'roomVotes',
} as const;

export type UserDoc = {
  uid: string;
  name?: string;
  nameLower?: string;
  profileImage?: string;
  fcmTokens?: string[];
  tempTitles?: string[]; // 다음 참여 전까지 표시
};

export type RoomDoc = {
  title: string;
  titleLower: string;
  type?: string;
  content?: string;
  location: string;
  capacity: number;
  startAt: string;   // ISO
  endAt: string;     // ISO (자동: 시작+5h)
  revealAt: string;  // ISO (시작-1h)
  kakaoOpenChatUrl?: string | null;
  creatorUid: string;
  participants: string[];
  participantsCount: number;
  closed: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type ScoreDoc = {
  total: number;
  createdRooms?: number;
  joinedRooms?: number;
  lastUpdatedAt?: string;
  thumbsCount?: number; // 👍 누적
  heartsCount?: number; // ❤️ 누적
};

export type VoteDoc = {
  roomId: string;
  voterUid: string;
  thumbsForUid?: string | null;     // 참가자 중 1명 (선택)
  heartForUid?: string | null;      // 참가자 중 1명 (선택)
  noshowUid?: string | 'none' | null; // 참가자 중 1명 또는 'none'
  createdAt: string;
  updatedAt: string;
};
