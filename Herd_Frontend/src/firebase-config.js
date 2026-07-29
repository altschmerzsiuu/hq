import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD9rj83Dg5fIzKRoE_aWgB_RT0oJ7_BV_0",
  authDomain: "herd-dashboard.firebaseapp.com",
  projectId: "herd-dashboard",
  storageBucket: "herd-dashboard.firebasestorage.app",
  messagingSenderId: "610578802472",
  appId: "1:610578802472:web:b7ece8b86f80e8dd89921d"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
export const messaging = typeof window !== "undefined" ? getMessaging(app) : null;

export const requestFirebaseNotificationPermission = async () => {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // NOTE: For Production, you usually need a VAPID Key here.
      // We will ask the user to generate it if we get a VAPID error.
      const token = await getToken(messaging);
      return token;
    } else {
      console.log('Permission not granted for Notification');
    }
  } catch (error) {
    console.error("An error occurred while retrieving token: ", error);
  }
  return null;
};
export const setupForegroundMessaging = (toast) => {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    console.log('Message received in foreground: ', payload);
    const { title, body } = payload.notification;
    
    // Show a sonner toast if provided (in-app alert without annoying system popup)
    if (toast) {
      toast(title, {
        description: body,
        duration: 5000,
      });
    }
  });
};
