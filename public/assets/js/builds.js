// =========================================================
// builds.js – Save / watch / delete user builds in Firestore.
// Each signed-in user gets a sub-collection:
//   users/{uid}/builds/{buildId}
// =========================================================
import { app } from './firebase-init.js';
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const db = getFirestore(app);

/**
 * Save a new build document under the currently signed-in user.
 * @param {{ ldrUrl: string, thumbDataUrl?: string|null, name?: string, meta?: object }} opts
 * @returns {Promise<string|null>} The new document ID, or null on failure.
 */
export async function saveBuild({ ldrUrl, thumbDataUrl = null, name = 'BrickHeadz', meta = {} }) {
  try {
    // Dynamically resolve the current user without importing Auth directly
    // (avoids circular dependency with auth.js)
    const { Auth } = await import('./auth.js');
    if (!Auth.current) return null;

    const uid = Auth.current.uid;
    const buildsRef = collection(db, 'users', uid, 'builds');

    const docRef = await addDoc(buildsRef, {
      ldrUrl,
      thumbUrl: thumbDataUrl, // may be null – that's fine
      name,
      meta,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (e) {
    console.warn('[builds] saveBuild error:', e);
    return null;
  }
}

/**
 * Subscribe to live updates for a user's builds, newest-first.
 * @param {string} uid
 * @param {(items: object[]) => void} onItems  Called with the full list on every change.
 * @param {(err: Error) => void}     onError
 * @returns {() => void} Unsubscribe function.
 */
export function watchUserBuilds(uid, onItems, onError) {
  const buildsRef = collection(db, 'users', uid, 'builds');
  const q = query(buildsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onItems(items);
    },
    (err) => {
      console.warn('[builds] watchUserBuilds error:', err);
      if (onError) onError(err);
    },
  );
}

/**
 * Delete a build document for a given user.
 * @param {string} uid
 * @param {string} buildId
 */
export async function deleteBuild(uid, buildId) {
  try {
    await deleteDoc(doc(db, 'users', uid, 'builds', buildId));
  } catch (e) {
    console.warn('[builds] deleteBuild error:', e);
    throw e;
  }
}
