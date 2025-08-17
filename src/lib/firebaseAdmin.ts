// src/lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';

declare global {
  // HMR/재빌드 시 중복 초기화 방지
  // eslint-disable-next-line no-var
  var __FIREBASE_ADMIN_APP__: admin.app.App | undefined;
}

function initAdminApp(): admin.app.App {
  if (globalThis.__FIREBASE_ADMIN_APP__) return globalThis.__FIREBASE_ADMIN_APP__;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_ADMIN_* env');
  }

  const app =
    admin.apps.length > 0
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });

  globalThis.__FIREBASE_ADMIN_APP__ = app;
  return app;
}

export function getAdminApp() {
  return initAdminApp();
}
export function getAdminDb() {
  return admin.firestore(getAdminApp());
}
export function getAdminAuth() {
  return admin.auth(getAdminApp());
}
export function getAdminMessaging() {
  return admin.messaging(getAdminApp());
}

export const adminFieldValue = admin.firestore.FieldValue;

/** 과거 코드 호환용: 값으로도 내보내기 */
export const adminDb = getAdminDb();
export const adminAuth = getAdminAuth();
export const adminMessaging = getAdminMessaging();
