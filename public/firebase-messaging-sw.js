// public/firebase-messaging-sw.js
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js');

// 공개 가능한 Web Config (클라이언트에서도 그대로 쓰는 값)
firebase.initializeApp({
  apiKey: "AIzaSyAcOQwF5kLxWiA3vxke8QOGYtmel9XEHqg",
  authDomain: "unicorn-2cb70.firebaseapp.com",
  projectId: "unicorn-2cb70",
  storageBucket: "unicorn-2cb70.appspot.com",
  messagingSenderId: "639623554137",
  appId: "1:639623554137:web:8a2a7abb22575709857d48"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'UNIcorn 알림';
  const options = {
    body: payload?.notification?.body || '',
    icon: '/icon-192.png', // 있으면 사용
    data: payload?.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  const url = event?.notification?.data?.url || '/';
  event.notification.close();
  event.waitUntil(clients.openWindow(url));
});
