import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const REMINDER_KEYS = {
  ENABLED: 'backup_reminder_enabled',
  NOTIF_ID: 'backup_reminder_notification_id',
} as const;

async function getNotifications() {
  // Lazy-load to avoid Expo Go startup crash/warnings.
  return await import('expo-notifications');
}

export async function getReminderEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(REMINDER_KEYS.ENABLED);
  return raw === '1';
}

export async function setReminderEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(REMINDER_KEYS.ENABLED, enabled ? '1' : '0');
}

async function getScheduledId(): Promise<string | null> {
  return await AsyncStorage.getItem(REMINDER_KEYS.NOTIF_ID);
}

async function setScheduledId(id: string | null): Promise<void> {
  if (id) await AsyncStorage.setItem(REMINDER_KEYS.NOTIF_ID, id);
  else await AsyncStorage.removeItem(REMINDER_KEYS.NOTIF_ID);
}

export async function ensureNotificationChannel(): Promise<void> {
  const Notifications = await getNotifications();
  await Notifications.setNotificationChannelAsync('backup-reminders', {
    name: 'Backup reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function scheduleDailyBackupReminderAt21(): Promise<void> {
  if (Constants.appOwnership === 'expo') {
    // Expo Go limitation
    throw new Error('NOTIFICATIONS_NOT_SUPPORTED_IN_EXPO_GO');
  }

  const Notifications = await getNotifications();
  await ensureNotificationChannel();
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('NOTIFICATIONS_DENIED');
  }

  const existing = await getScheduledId();
  if (existing) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existing);
    } catch {
      // ignore
    }
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Backup reminder',
      body: 'Export your daily backup to keep your data safe.',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 21,
      minute: 0,
      channelId: 'backup-reminders',
    },
  });

  await setScheduledId(id);
  await setReminderEnabled(true);
}

export async function disableDailyBackupReminder(): Promise<void> {
  const Notifications = await getNotifications();
  const existing = await getScheduledId();
  if (existing) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existing);
    } catch {
      // ignore
    }
  }
  await setScheduledId(null);
  await setReminderEnabled(false);
}

