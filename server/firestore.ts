import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let configCache: any = null;

export function getFirebaseConfig() {
  if (configCache) return configCache;
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      configCache = JSON.parse(raw);
      return configCache;
    }
  } catch (err) {
    console.error('Failed to read firebase-applet-config.json:', err);
  }
  return null;
}

export function getFirestoreDb(): Firestore | null {
  if (dbInstance) return dbInstance;

  const config = getFirebaseConfig();
  if (!config) {
    console.warn('Firebase configuration not found. Running in fallback mode.');
    return null;
  }

  try {
    if (getApps().length === 0) {
      appInstance = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });
    } else {
      appInstance = getApp();
    }

    const databaseId = config.firestoreDatabaseId || '(default)';
    dbInstance = getFirestore(appInstance, databaseId);
    console.log(`[Firestore] Connected successfully to project: ${config.projectId} (DB: ${databaseId})`);
    return dbInstance;
  } catch (err) {
    console.error('[Firestore] Initialization error:', err);
    return null;
  }
}

export async function testFirestoreConnection(): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) return false;
  try {
    // Ping firestore server according to firebase-skill validation rule
    await getDocFromServer(doc(db, '_connection_test', 'health'));
    return true;
  } catch (err: any) {
    if (err?.code === 'unavailable' || err?.message?.includes('offline')) {
      console.warn('[Firestore] Network or connection is offline:', err.message);
      return false;
    }
    // Document not existing is still a successful network roundtrip
    return true;
  }
}
