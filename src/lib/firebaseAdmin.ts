// src/lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';
import { getAuth as _getAuth } from 'firebase-admin/auth';
import { getFirestore as _getFirestore } from 'firebase-admin/firestore';
import { getMessaging as _getMessaging } from 'firebase-admin/messaging';

let adminApp: admin.app.App | null = null;

function getAdminApp() {
  if (adminApp) return adminApp;
  if (admin.apps.length) {
    adminApp = admin.app();
    return adminApp;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_ADMIN_* env');
  }

  adminApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });
  return adminApp;
}

export function getAdminAuth() {
  return _getAuth(getAdminApp());
}

export function getAdminDb() {
  return _getFirestore(getAdminApp());
}

export function getAdminMessaging() {
  return _getMessaging(getAdminApp());
}

// (원하면) 기본 내보내기
export default { getAdminApp, getAdminAuth, getAdminDb, getAdminMessaging };
