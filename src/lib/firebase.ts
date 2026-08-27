import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfigJson from '@/firebase-applet-config.json';

// Build the configuration using environment variables if defined, otherwise fall back to local config JSON.
const getEnvOrConfig = (envVal: any, configVal: any) => {
  if (envVal === undefined || envVal === null || envVal === '' || envVal === 'undefined') {
    return configVal;
  }
  return envVal;
};

const firebaseConfig = {
  apiKey: getEnvOrConfig(import.meta.env.VITE_FIREBASE_API_KEY, firebaseConfigJson.apiKey),
  authDomain: getEnvOrConfig(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, firebaseConfigJson.authDomain),
  projectId: getEnvOrConfig(import.meta.env.VITE_FIREBASE_PROJECT_ID, firebaseConfigJson.projectId),
  storageBucket: getEnvOrConfig(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, firebaseConfigJson.storageBucket),
  messagingSenderId: getEnvOrConfig(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, firebaseConfigJson.messagingSenderId),
  appId: getEnvOrConfig(import.meta.env.VITE_FIREBASE_APP_ID, firebaseConfigJson.appId),
  measurementId: getEnvOrConfig(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, firebaseConfigJson.measurementId),
  firestoreDatabaseId: getEnvOrConfig(import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID, (firebaseConfigJson as any).firestoreDatabaseId)
};

const app = initializeApp(firebaseConfig);

// Set Firestore log level to error to avoid noisy offline/unavailable connection warnings
try {
  setLogLevel('error');
} catch (_) {}

// Modern way to enable multi-tab persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  ignoreUndefinedProperties: true
}, firebaseConfig.firestoreDatabaseId || undefined);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => auth.signOut();

// Helper to load Google Identity Services script
const loadGsiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existingScript = document.getElementById('gsi-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }
    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services library'));
    document.head.appendChild(script);
  });
};

export const signInWithGoogleDrive = async (): Promise<string | null> => {
  try {
    await loadGsiScript();
    const clientId = (firebaseConfigJson as any).oAuthClientId || "386952171266-j6frhslkoae8aa0itcca6u96r80l7ink.apps.googleusercontent.com";
    
    return await new Promise<string>((resolve, reject) => {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
          } else if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('No access token received from Google OAuth'));
          }
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || 'Google OAuth prompt error'));
        }
      });
      client.requestAccessToken({ prompt: 'select_account' });
    });
  } catch (gsiError: any) {
    console.warn("GIS token client failed:", gsiError);
    if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_')) {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      return credential?.accessToken || null;
    } else {
      throw new Error(gsiError?.message || "Failed to initialize Google login popup. Please check your browser popup blocker settings.");
    }
  }
};
