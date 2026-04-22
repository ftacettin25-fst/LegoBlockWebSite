// =========================================================
// Auth: sign in / up / out, Google OAuth, navbar binding.
// Uses Firebase modular SDK loaded via firebase-init.js.
// =========================================================
import { auth, googleProvider } from './firebase-init.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export const Auth = {
  current: null,
  _subs: new Set(),

  onChange(cb) {
    this._subs.add(cb);
    if (this.current !== undefined) cb(this.current);
    return () => this._subs.delete(cb);
  },

  _emit(user) {
    this.current = user;
    this._subs.forEach((cb) => cb(user));
  },

  signInEmail(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  },
  signUpEmail(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  },
  signInGoogle() {
    return signInWithPopup(auth, googleProvider);
  },
  resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  },
  signOut() {
    return signOut(auth);
  },
};

onAuthStateChanged(auth, (user) => Auth._emit(user));

// Helper: bind a nav slot to live auth state
export function bindNavAccount(slotEl) {
  if (!slotEl) return;
  Auth.onChange((user) => {
    if (!user) {
      slotEl.innerHTML = `
        <a href="account.html" class="btn btn--accent btn--sm">
          <i data-lucide="user"></i> Sign in
        </a>`;
    } else {
      slotEl.innerHTML = `
        <div class="account-menu" id="account-menu">
          <button class="icon-btn" id="account-trigger" aria-label="Account">
            <i data-lucide="user"></i>
          </button>
          <div class="account-menu__panel">
            <div class="account-menu__email">${user.email || 'Signed in'}</div>
            <a class="account-menu__item" href="account.html">
              <i data-lucide="user"></i> Account
            </a>
            <button class="account-menu__item" id="account-signout">
              <i data-lucide="log-out"></i> Sign out
            </button>
          </div>
        </div>`;
      const menu = slotEl.querySelector('#account-menu');
      slotEl.querySelector('#account-trigger').addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('open');
      });
      slotEl.querySelector('#account-signout').addEventListener('click', async () => {
        await Auth.signOut();
      });
      document.addEventListener('click', () => menu.classList.remove('open'));
    }
    if (window.lucide) window.lucide.createIcons();
  });
}
