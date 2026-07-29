importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyD9rj83Dg5fIzKRoE_aWgB_RT0oJ7_BV_0",
  authDomain: "herd-dashboard.firebaseapp.com",
  projectId: "herd-dashboard",
  storageBucket: "herd-dashboard.firebasestorage.app",
  messagingSenderId: "610578802472",
  appId: "1:610578802472:web:b7ece8b86f80e8dd89921d"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png', // Assuming there's a logo.png in public
    badge: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
