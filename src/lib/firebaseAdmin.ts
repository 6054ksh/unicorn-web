// src/lib/firebaseAdmin.ts
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Vercel 환경변수에 아래 값들이 존재해야 함
// FIREBASE_ADMIN_PROJECT_ID
// FIREBASE_ADMIN_CLIENT_EMAIL
// FIREBASE_ADMIN_PRIVATE_KEY  (줄바꿈이 \n 로 들어있는 경우가 많아 replace 처리)

function initAdminApp(): App {
  const apps = getApps();
  if (apps.length) return apps[0];

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
  // Vercel에 저장 시 \n 로 들어간 경우 실제 개행으로 변환
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const app = initAdminApp();

export const adminApp = app;
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminFieldValue = FieldValue;
export const adminMessaging = getMessaging(app);
