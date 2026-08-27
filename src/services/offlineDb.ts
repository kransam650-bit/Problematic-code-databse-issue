import { Patient, Outcome } from '../types';

const DB_NAME = 'PatientRecordsOfflineDB';
const DB_VERSION = 2;
const STORE_NAME = 'patients';

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      reject(request.error);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config');
      }
    };
  });
}

export function getTimestampMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') {
    return ts.toMillis();
  }
  if (ts.seconds) {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
  }
  const parsed = Date.parse(ts);
  return isNaN(parsed) ? 0 : parsed;
}

export async function saveLocalPatient(patient: Patient): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(patient);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalPatients(patients: Patient[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    patients.forEach(p => {
      store.put(p);
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getLocalPatients(): Promise<Patient[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const all = request.result as (Patient & { isDeleted?: boolean })[];
      // Filter out soft-deleted records and sort by date/createdAt descending as a fallback
      const active = all.filter(p => !p.isDeleted);
      active.sort((a, b) => {
        const timeA = getTimestampMs(a.createdAt || a.localUpdatedAt);
        const timeB = getTimestampMs(b.createdAt || b.localUpdatedAt);
        return timeB - timeA;
      });
      resolve(active);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getLocalPatientById(id: string): Promise<Patient | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      const p = request.result as (Patient & { isDeleted?: boolean }) | undefined;
      if (p && !p.isDeleted) {
        resolve(p);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllLocalRecordsRaw(): Promise<Patient[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      resolve(request.result as Patient[]);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteLocalPatient(id: string): Promise<void> {
  const db = await openDB();
  const existing = await getLocalPatientById(id);
  if (!existing) return;
  
  if (id.startsWith('local_')) {
    // Purely local patient, delete physically
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  // Cloud patient, mark as soft-deleted and unsynced
  const updated: Patient & { isDeleted: boolean; synced: boolean; localUpdatedAt: string } = {
    ...existing,
    isDeleted: true,
    synced: false,
    localUpdatedAt: new Date().toISOString()
  };
  await saveLocalPatient(updated);
}

export async function saveSyncFolderHandle(handle: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('config', 'readwrite');
    const store = transaction.objectStore('config');
    const request = store.put(handle, 'syncFolderHandle');
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSyncFolderHandle(): Promise<any> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains('config')) {
      resolve(null);
      return;
    }
    const transaction = db.transaction('config', 'readonly');
    const store = transaction.objectStore('config');
    const request = store.get('syncFolderHandle');
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function removeSyncFolderHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains('config')) {
      resolve();
      return;
    }
    const transaction = db.transaction('config', 'readwrite');
    const store = transaction.objectStore('config');
    const request = store.delete('syncFolderHandle');
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveAutomaticBackup(patients: Patient[]): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('config', 'readwrite');
    const store = transaction.objectStore('config');
    
    const getReq = store.get('backup_slot_1');
    getReq.onsuccess = () => {
      const b1 = getReq.result;
      
      const saveNewBackup = () => {
        const newBackup = {
          data: patients,
          timestamp: new Date().toISOString()
        };
        const putReq = store.put(newBackup, 'backup_slot_1');
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      if (b1) {
        const putReq2 = store.put(b1, 'backup_slot_2');
        putReq2.onsuccess = () => {
          saveNewBackup();
        };
        putReq2.onerror = () => reject(putReq2.error);
      } else {
        saveNewBackup();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getAutomaticBackups(): Promise<{
  backup1: { data: Patient[]; timestamp: string } | null;
  backup2: { data: Patient[]; timestamp: string } | null;
}> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('config', 'readonly');
    const store = transaction.objectStore('config');
    
    const req1 = store.get('backup_slot_1');
    req1.onsuccess = () => {
      const b1 = req1.result || null;
      const req2 = store.get('backup_slot_2');
      req2.onsuccess = () => {
        const b2 = req2.result || null;
        resolve({ backup1: b1, backup2: b2 });
      };
      req2.onerror = () => reject(req2.error);
    };
    req1.onerror = () => reject(req1.error);
  });
}

