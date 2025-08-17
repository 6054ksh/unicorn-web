import * as admin from 'firebase-admin';

let app: admin.app.App | null = null;

function getApp() {
  if (app) return app;
  if (admin.apps.length) {
    app = admin.app();
    return app;
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_ADMIN_* env');
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  return app;
}

export function getAdminDb() {
  return admin.firestore(getApp());
}
export function getAdminAuth() {
  return admin.auth(getApp());
}
export function getAdminMessaging() {
  return admin.messaging(getApp());
}
export const adminFieldValue = admin.firestore.FieldValue;
