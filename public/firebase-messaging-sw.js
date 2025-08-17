/* eslint-disable no-undef */
// ⚠️ SW는 env를 못 읽음. 아래 config는 클라이언트와 동일하게 직접 기입해야 함.
const firebaseConfig = {
  apiKey: "AIzaSyAcOQwF5kLxWiA3vxke8QOGYtmel9XEHqg",
  authDomain: "unicorn-2cb70.firebaseapp.com",
  projectId: "unicorn-2cb70",
  storageBucket: "unicorn-2cb70.appspot.com",
  messagingSenderId: "639623554137",
  appId: "1:639623554137:web:8a2a7abb22575709857d48",
};

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // notification payload가 오면 표시
  const title = payload.notification?.title || 'UNIcorn';
  const options = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});
