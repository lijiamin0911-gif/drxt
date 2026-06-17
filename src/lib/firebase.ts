import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const isConfigured = 
  firebaseConfig && 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'PLACEHOLDER' &&
  firebaseConfig.projectId !== 'PLACEHOLDER';

let app;
let db: any = null;
let auth: any = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
}

export { db, auth };
export let isFirebaseConfigured = isConfigured;
export function disableFirebase() {
  isFirebaseConfigured = false;
  console.warn('⚠️ Firebase has been disabled due to connection/offline failure. Falling back to Local Storage.');
}
export const googleProvider = new GoogleAuthProvider();
export { signInWithPopup };
