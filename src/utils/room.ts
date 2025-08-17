export type Room = {
  id: string;
  title: string;
  type: string;        // 모임종류
  content: string;     // 내용
  location: string;
  startAt: string;     // ISO (서버에서 Date로 저장해도 표시 시 변환)
  capacity: number;
  creatorUid: string;
  createdAt: string;
  joinLockUntil: string; // 개설 후 10분
  revealAt: string;      // startAt - 60분
  endAt: string;         // startAt + 8시간
  closed: boolean;       // 개설자가 종료 눌렀는지
  participants: string[];// uid 목록
  participantsCount: number;
  kakaoOpenChatUrl?: string;
};

export function getStatus(now: Date, startAt: Date, endAt: Date, closed: boolean) {
  if (closed || now >= endAt) return '모임종료';
  if (now >= startAt) return '모임중';
  return '모임 준비중';
}
