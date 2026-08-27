import { Patient } from '../types';

export interface SyncConflict {
  id: string;
  local: Patient;
  remote: Patient;
}

import { 
  openDB,
  saveLocalPatient, 
  saveLocalPatients,
  getLocalPatients, 
  getLocalPatientById, 
  getAllLocalRecordsRaw, 
  deleteLocalPatient as deleteLocalOffline, 
  getTimestampMs,
  saveSyncFolderHandle,
  getSyncFolderHandle,
  removeSyncFolderHandle,
  saveAutomaticBackup,
  getAutomaticBackups
} from './offlineDb';

export { 
  openDB,
  saveLocalPatients,
  getAllLocalRecordsRaw, 
  saveSyncFolderHandle, 
  getSyncFolderHandle, 
  removeSyncFolderHandle,
  saveAutomaticBackup,
  getAutomaticBackups
};

export function isOnlineAllowed(): boolean {
  return false;
}

export function getCurrentUserId(): string | null {
  return 'offline_user';
}

/**
 * Syncs local offline data. Since we are completely offline, this is a no-op
 * but calls onSyncCompleted with local records for compatibility.
 */
export async function syncPatients(onSyncCompleted?: (patients: Patient[]) => void): Promise<void> {
  if (onSyncCompleted) {
    try {
      const local = await getLocalPatients();
      onSyncCompleted(local);
    } catch (e) {
      console.error('Failed to load local patients for callback:', e);
    }
  }
}

export async function createPatient(data: Omit<Patient, 'id' | 'createdAt' | 'createdBy'>): Promise<Patient> {
  const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const patientId = `PAT-${String(data.serialNo).padStart(2, '0')}`;
  const localPatient: Patient = {
    ...data,
    id: localId,
    patientId,
    createdAt: new Date().toISOString(),
    localUpdatedAt: new Date().toISOString(),
    createdBy: 'offline_user',
    synced: true
  };

  await saveLocalPatient(localPatient);
  return localPatient;
}

export async function getPatients(onSyncCompleted?: (patients: Patient[]) => void): Promise<Patient[]> {
  const localPatients = await getLocalPatients();
  if (onSyncCompleted) {
    onSyncCompleted(localPatients);
  }
  return localPatients;
}

export async function updatePatient(id: string, data: Partial<Patient>): Promise<Patient> {
  const existing = await getLocalPatientById(id);
  if (!existing) {
    throw new Error(`Patient with ID ${id} not found in offline database.`);
  }

  const updatedPatient: Patient = {
    ...existing,
    ...data,
    synced: true,
    localUpdatedAt: new Date().toISOString()
  };

  if (data.serialNo !== undefined) {
    updatedPatient.patientId = `PAT-${String(data.serialNo).padStart(2, '0')}`;
  }

  await saveLocalPatient(updatedPatient);
  return updatedPatient;
}

export async function deletePatient(id: string): Promise<void> {
  try {
    await updatePatient(id, {
      isDeleted: true,
      deletedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error soft-deleting patient:', error);
    throw error;
  }
}

export async function restorePatient(id: string): Promise<void> {
  try {
    await updatePatient(id, {
      isDeleted: false,
      deletedAt: ""
    });
  } catch (error) {
    console.error('Error restoring patient:', error);
    throw error;
  }
}

export async function permanentlyDeletePatient(id: string): Promise<void> {
  try {
    await deleteLocalOffline(id);
  } catch (error) {
    console.error('Error permanently deleting local patient:', error);
    throw error;
  }
}

export async function getPendingSyncCount(): Promise<number> {
  return 0;
}

export async function restorePatientsBackup(restored: Patient[]): Promise<void> {
  const dbInstance = await openDB();
  const rawLocal = await getAllLocalRecordsRaw();
  const localMap = new Map<string, Patient>();
  rawLocal.forEach(p => {
    if (p.id) localMap.set(p.id, p);
  });

  const transaction = dbInstance.transaction('patients', 'readwrite');
  const store = transaction.objectStore('patients');

  for (const patient of restored) {
    if (!patient.id) continue;
    
    const finalPatient: Patient = {
      ...patient,
      createdBy: 'offline_user',
      synced: true,
      localUpdatedAt: new Date().toISOString()
    };

    const existing = localMap.get(patient.id);
    if (existing) {
      const existingTime = getTimestampMs(existing.localUpdatedAt || existing.updatedAt);
      const restoredTime = getTimestampMs(patient.localUpdatedAt || patient.updatedAt);
      
      if (restoredTime > existingTime) {
        store.put(finalPatient);
      }
    } else {
      store.put(finalPatient);
    }
  }

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getSyncConflicts(): Promise<SyncConflict[]> {
  return [];
}

export async function resolveConflictKeepLocal(id: string): Promise<void> {}
export async function resolveConflictKeepCloud(id: string): Promise<void> {}
export async function resolveConflictCustom(id: string, mergedPatient: Patient): Promise<void> {}
export async function migrateGuestRecords(newUserId: string): Promise<void> {}
