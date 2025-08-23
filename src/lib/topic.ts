export function topicForRoom(roomId: string) {
  return 'room_' + encodeURIComponent(roomId);
}

// 전체 사용자 대상 “방 생성 공지” 토픽
export const TOPIC_ALL_ROOMS = 'rooms_all';
