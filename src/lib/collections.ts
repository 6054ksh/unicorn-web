// src/lib/collections.ts
export const COL = {
  rooms: process.env.FIRESTORE_ROOMS_COL || 'rooms',
  roomsArchive: process.env.FIRESTORE_ROOMS_ARCHIVE_COL || 'rooms_archive',
  users: 'users',
  admins: 'admins',
  scores: 'scores',
  feedback: 'feedback',
  userFcmTokens: 'user_fcm_tokens',
} as const;
