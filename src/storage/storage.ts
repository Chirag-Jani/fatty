import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  DayFoodLog,
  FoodTemplate,
  FoodTemplatesById,
  FoodLogsByDate,
  FoodEntry,
  MealSection,
  StepsLogsByDate,
  UserProfile,
  WaterLogsByDate,
  WeightLogsByDate,
} from '../types';

const KEYS = {
  USER_PROFILE: 'user_profile',
  FOOD_LOGS: 'food_logs',
  FOOD_TEMPLATES: 'food_templates',
  WATER_LOGS: 'water_logs',
  STEPS_LOGS: 'steps_logs',
  WEIGHT_LOGS: 'weight_logs',
} as const;

const emptyDay = (): DayFoodLog => ({
  breakfast: [],
  lunch: [],
  dinner: [],
  snacks: [],
});

export async function getUserProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(KEYS.USER_PROFILE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
}

export async function getFoodLogs(): Promise<FoodLogsByDate> {
  const raw = await AsyncStorage.getItem(KEYS.FOOD_LOGS);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== 'object') return {};

    // Back-compat: older FoodEntry items may not have amount/amountUnit.
    for (const day of Object.values(parsed)) {
      if (!day || typeof day !== 'object') continue;
      for (const section of ['breakfast', 'lunch', 'dinner', 'snacks'] as const) {
        const arr = (day as any)[section];
        if (!Array.isArray(arr)) continue;
        (day as any)[section] = arr.map((e: any) => {
          if (!e || typeof e !== 'object') return e;
          return {
            ...e,
            amount: typeof e.amount === 'number' ? e.amount : 0,
            amountUnit: e.amountUnit === 'ml' || e.amountUnit === 'pcs' ? e.amountUnit : 'g',
            loggedAt: typeof e.loggedAt === 'number' && !Number.isNaN(e.loggedAt) ? e.loggedAt : undefined,
          };
        });
      }
    }

    return parsed as FoodLogsByDate;
  } catch {
    return {};
  }
}

export async function getDayFoodLog(dateKey: string): Promise<DayFoodLog> {
  const all = await getFoodLogs();
  return all[dateKey] ?? emptyDay();
}

export async function getFoodTemplates(): Promise<FoodTemplatesById> {
  const raw = await AsyncStorage.getItem(KEYS.FOOD_TEMPLATES);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, any>;
    const out: FoodTemplatesById = {};
    for (const [id, t] of Object.entries(parsed ?? {})) {
      if (!t || typeof t !== 'object') continue;
      // Back-compat: older templates used kcalPer100g/proteinPer100g/etc and had no amountUnit.
      const amountUnit =
        t.amountUnit === 'ml' || t.amountUnit === 'g' || t.amountUnit === 'pcs'
          ? t.amountUnit
          : 'g';
      const kcalPer100 = typeof t.kcalPer100 === 'number' ? t.kcalPer100 : t.kcalPer100g;
      const proteinPer100 = typeof t.proteinPer100 === 'number' ? t.proteinPer100 : t.proteinPer100g;
      const carbsPer100 = typeof t.carbsPer100 === 'number' ? t.carbsPer100 : t.carbsPer100g;
      const fatPer100 = typeof t.fatPer100 === 'number' ? t.fatPer100 : t.fatPer100g;
      if (typeof t.name !== 'string') continue;
      out[id] = {
        id,
        name: t.name,
        amountUnit,
        kcalPer100: typeof kcalPer100 === 'number' ? kcalPer100 : 0,
        proteinPer100: typeof proteinPer100 === 'number' ? proteinPer100 : 0,
        carbsPer100: typeof carbsPer100 === 'number' ? carbsPer100 : 0,
        fatPer100: typeof fatPer100 === 'number' ? fatPer100 : 0,
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      };
    }
    return out;
  } catch {
    return {};
  }
}

export async function addFoodTemplate(template: FoodTemplate): Promise<void> {
  const all = await getFoodTemplates();
  all[template.id] = template;
  await AsyncStorage.setItem(KEYS.FOOD_TEMPLATES, JSON.stringify(all));
}

export async function updateFoodTemplate(template: FoodTemplate): Promise<void> {
  const all = await getFoodTemplates();
  if (!all[template.id]) return;
  all[template.id] = template;
  await AsyncStorage.setItem(KEYS.FOOD_TEMPLATES, JSON.stringify(all));
}

export async function deleteFoodTemplate(id: string): Promise<void> {
  const all = await getFoodTemplates();
  if (!all[id]) return;
  delete all[id];
  await AsyncStorage.setItem(KEYS.FOOD_TEMPLATES, JSON.stringify(all));
}

export async function addFoodEntry(
  dateKey: string,
  section: MealSection,
  entry: FoodEntry
): Promise<void> {
  const all = await getFoodLogs();
  const day = all[dateKey] ?? emptyDay();
  day[section] = [...day[section], entry];
  all[dateKey] = day;
  await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(all));
}

export async function removeFoodEntry(
  dateKey: string,
  section: MealSection,
  entryId: string
): Promise<void> {
  const all = await getFoodLogs();
  const day = all[dateKey];
  if (!day) return;
  day[section] = day[section].filter((e) => e.id !== entryId);
  all[dateKey] = day;
  await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(all));
}

export async function updateFoodEntry(
  dateKey: string,
  entryId: string,
  patch: Partial<FoodEntry> & { section?: MealSection }
): Promise<void> {
  const all = await getFoodLogs();
  const day = all[dateKey];
  if (!day) return;

  let foundSection: MealSection | null = null;
  for (const s of ['breakfast', 'lunch', 'dinner', 'snacks'] as const) {
    if (day[s].some((e) => e.id === entryId)) {
      foundSection = s;
      break;
    }
  }
  if (!foundSection) return;

  const { section: targetSection, ...rest } = patch;
  const prev = day[foundSection].find((e) => e.id === entryId)!;
  const merged: FoodEntry = { ...prev, ...rest, id: entryId };
  const nextSection = targetSection ?? foundSection;

  if (nextSection === foundSection) {
    day[foundSection] = day[foundSection].map((e) => (e.id === entryId ? merged : e));
  } else {
    day[foundSection] = day[foundSection].filter((e) => e.id !== entryId);
    day[nextSection] = [...day[nextSection], merged];
  }
  all[dateKey] = day;
  await AsyncStorage.setItem(KEYS.FOOD_LOGS, JSON.stringify(all));
}

export async function getWaterLogs(): Promise<WaterLogsByDate> {
  const raw = await AsyncStorage.getItem(KEYS.WATER_LOGS);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as WaterLogsByDate;
  } catch {
    return {};
  }
}

export async function getWaterMl(dateKey: string): Promise<number> {
  const logs = await getWaterLogs();
  return logs[dateKey] ?? 0;
}

export async function addWaterMl(dateKey: string, ml: number): Promise<void> {
  const logs = await getWaterLogs();
  const next = (logs[dateKey] ?? 0) + ml;
  logs[dateKey] = Math.max(0, next);
  await AsyncStorage.setItem(KEYS.WATER_LOGS, JSON.stringify(logs));
}

export async function setWaterMl(dateKey: string, ml: number): Promise<void> {
  const logs = await getWaterLogs();
  logs[dateKey] = Math.max(0, ml);
  await AsyncStorage.setItem(KEYS.WATER_LOGS, JSON.stringify(logs));
}

export async function getStepsLogs(): Promise<StepsLogsByDate> {
  const raw = await AsyncStorage.getItem(KEYS.STEPS_LOGS);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as StepsLogsByDate;
  } catch {
    return {};
  }
}

export async function getStepsForDay(dateKey: string): Promise<number> {
  const logs = await getStepsLogs();
  return logs[dateKey] ?? 0;
}

export async function setStepsForDay(dateKey: string, steps: number): Promise<void> {
  const logs = await getStepsLogs();
  logs[dateKey] = Math.max(0, Math.round(steps));
  await AsyncStorage.setItem(KEYS.STEPS_LOGS, JSON.stringify(logs));
}

export async function getWeightLogs(): Promise<WeightLogsByDate> {
  const raw = await AsyncStorage.getItem(KEYS.WEIGHT_LOGS);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as WeightLogsByDate;
  } catch {
    return {};
  }
}

export async function setWeightForDay(dateKey: string, weightKg: number): Promise<void> {
  const logs = await getWeightLogs();
  logs[dateKey] = weightKg;
  await AsyncStorage.setItem(KEYS.WEIGHT_LOGS, JSON.stringify(logs));
}

export async function getLatestWeight(): Promise<{ dateKey: string; kg: number } | null> {
  const logs = await getWeightLogs();
  const keys = Object.keys(logs).sort((a, b) => b.localeCompare(a));
  for (const k of keys) {
    const w = logs[k];
    if (typeof w === 'number' && !Number.isNaN(w)) {
      return { dateKey: k, kg: w };
    }
  }
  return null;
}
