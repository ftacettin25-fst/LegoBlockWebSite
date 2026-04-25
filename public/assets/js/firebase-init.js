// =========================================================
// Firebase initialization (modular SDK via CDN)
// Replace firebaseConfig values with the ones from your
// Firebase Console → Project settings → Your apps (Web).
// These are PUBLIC keys; safe to commit.
// =========================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// TODO: replace with your real Firebase web config
export const firebaseConfig = {
  apiKey: 'AIzaSyA1LnlN73Sg67jtG_hY2k8BoBVUof4EPrI',
  authDomain: 'legoproje-c4094.firebaseapp.com',
  projectId: 'legoproje-c4094',
  storageBucket: 'legoproje-c4094.firebasestorage.app',
  messagingSenderId: '979628463997',
  appId: '1:979628463997:web:9c4d25d745317caedc5e14',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Keep users signed in across page loads (the site is multi-page HTML)
setPersistence(auth, browserLocalPersistence).catch((e) =>
  console.warn('[Firebase] persistence:', e),
);
