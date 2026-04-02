import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths } from 'expo-file-system';
import * as LegacyFS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export const BACKUP_KEYS = [
  'user_profile',
  'food_logs',
  'food_templates',
  'water_logs',
  'steps_logs',
  'weight_logs',
] as const;

export type BackupPayloadV1 = {
  version: 1;
  exportedAt: number;
  data: Record<(typeof BACKUP_KEYS)[number], string | null>;
};

const META_KEYS = {
  LAST_EXPORT_AT: 'backup_last_export_at',
} as const;

export async function getLastBackupAt(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(META_KEYS.LAST_EXPORT_AT);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

async function writeBackupFile(payload: BackupPayloadV1): Promise<string> {
  const dir = `${Paths.document.uri}backups/`;
  await LegacyFS.makeDirectoryAsync(dir, { intermediates: true });
  const filename = `fatty-backup-${new Date(payload.exportedAt).toISOString().replace(/[:.]/g, '-')}.json`;
  const path = `${dir}${filename}`;
  await LegacyFS.writeAsStringAsync(path, JSON.stringify(payload));
  return path;
}

export async function exportBackup(): Promise<{ fileUri: string }> {
  const entries = await AsyncStorage.multiGet([...BACKUP_KEYS]);
  const data = Object.fromEntries(entries) as BackupPayloadV1['data'];
  const payload: BackupPayloadV1 = {
    version: 1,
    exportedAt: Date.now(),
    data,
  };
  const fileUri = await writeBackupFile(payload);
  await AsyncStorage.setItem(META_KEYS.LAST_EXPORT_AT, String(payload.exportedAt));

  if (await Sharing.isAvailableAsync()) {
    try {
      await Sharing.shareAsync(fileUri, {
        dialogTitle: 'Export backup',
        mimeType: 'application/json',
        UTI: 'public.json',
      });
    } catch {
      // User may cancel share sheet; backup is still created successfully.
    }
  }

  return { fileUri };
}

export async function pickAndImportBackup(): Promise<{ importedAt: number }> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (res.canceled) {
    throw new Error('CANCELLED');
  }

  const asset = res.assets?.[0];
  if (!asset?.uri) {
    throw new Error('No file selected');
  }

  const raw = await LegacyFS.readAsStringAsync(asset.uri);

  const parsed = JSON.parse(raw) as Partial<BackupPayloadV1>;
  if (parsed.version !== 1 || typeof parsed.exportedAt !== 'number' || !parsed.data) {
    throw new Error('Invalid backup file');
  }

  const pairs: [string, string][] = [];
  for (const k of BACKUP_KEYS) {
    const v = (parsed.data as any)[k];
    // If missing, write null to clear that dataset (keeps restore deterministic)
    if (typeof v === 'string') pairs.push([k, v]);
    else pairs.push([k, 'null']);
  }

  await AsyncStorage.multiSet(pairs);
  return { importedAt: Date.now() };
}

