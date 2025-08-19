// src/lib/firebaseAdmin.ts
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

let _app: App | null = null;

function readEnv(keyA: string, keyB?: string) {
  return process.env[keyA] ?? (keyB ? process.env[keyB] : undefined);
}

export function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApps()[0]!;
    return _app;
  }

  // BOTH supported (ADMIN_* 우선, 없으면 일반 키 사용)
  const projectId =
    readEnv('FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_PROJECT_ID')!;
  const clientEmail =
    readEnv('FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_CLIENT_EMAIL')!;
  const privateKeyRaw =
    readEnv('FIREBASE_ADMIN_PRIVATE_KEY', 'FIREBASE_PRIVATE_KEY')!;

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  _app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });

  return _app;
}

export const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminMessaging = getMessaging(adminApp);

// get* API도 그대로 내보냄 (원 코드 호환)
export function getAdminAuth() {
  return adminAuth;
}
export function getAdminDb() {
  return adminDb;
}
export function getAdminMessaging() {
  return adminMessaging;
}

export default { getAdminApp, getAdminAuth, getAdminDb, getAdminMessaging, adminAuth, adminDb, adminMessaging };
