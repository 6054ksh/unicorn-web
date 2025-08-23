// src/lib/topic.ts
export function topicForRoom(roomId: string) {
  // 토픽 허용 문자: [A-Za-z0-9-_.~%]
  // URL 인코딩해서 안전하게 사용
  return 'room_' + encodeURIComponent(roomId);
}
