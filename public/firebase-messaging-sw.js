/* public/firebase-messaging-sw.js */
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-messaging-compat.js');

// ↓ 여러분의 Firebase 웹 설정으로 교체
firebase.initializeApp({
  apiKey: "AIzaSyAcOQwF5kLxWiA3vxke8QOGYtmel9XEHqg",
  authDomain: "unicorn-2cb70.firebaseapp.com",
  projectId: "unicorn-2cb70",
  messagingSenderId: "639623554137",
  appId: "1:639623554137:web:8a2a7abb22575709857d48",
});

const messaging = firebase.messaging();

// 백그라운드(앱/탭 닫힘) 수신 처리
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || '알림';
  const options = {
    body: payload?.notification?.body || '',
    data: payload?.data || {},
    tag: payload?.notification?.tag,
    renotify: true,
  };
  self.registration.showNotification(title, options);
});

// 클릭 시 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
