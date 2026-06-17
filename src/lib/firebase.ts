// src/lib/firebase.ts

export const db: any = null;
export const auth: any = null;
export const isFirebaseConfigured = false;

export function disableFirebase() {
  console.warn('⚠️ Firebase has been disabled for offline local mode.');
}

export const googleProvider: any = null;
export const signInWithPopup: any = null;
