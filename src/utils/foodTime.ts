import { endOfDay, format, parse, startOfDay } from 'date-fns';
import type { DayFoodLog, FoodEntry, MealSection } from '../types';

export const MEAL_SECTION_ORDER: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

const DEFAULT_MINUTES: Record<MealSection, number> = {
  breakfast: 8 * 60,
  lunch: 12 * 60 + 30,
  dinner: 19 * 60,
  snacks: 15 * 60 + 30,
};

export function parseDateKeyLocal(dateKey: string): Date {
  return parse(dateKey, 'yyyy-MM-dd', new Date());
}

export function defaultLoggedAtMs(dateKey: string, section: MealSection): number {
  const d = startOfDay(parseDateKeyLocal(dateKey));
  return d.getTime() + DEFAULT_MINUTES[section] * 60 * 1000;
}

/** Stable ordering for entries that never stored `loggedAt` (legacy data). */
export function effectiveLoggedAtMs(
  entry: FoodEntry,
  dateKey: string,
  section: MealSection,
  indexInSection: number
): number {
  if (typeof entry.loggedAt === 'number' && !Number.isNaN(entry.loggedAt)) {
    return entry.loggedAt;
  }
  return defaultLoggedAtMs(dateKey, section) + indexInSection * 60_000;
}

export function sortEntriesByTime(
  entries: FoodEntry[],
  dateKey: string,
  section: MealSection
): FoodEntry[] {
  return entries
    .map((e, i) => ({ e, i }))
    .sort(
      (a, b) =>
        effectiveLoggedAtMs(a.e, dateKey, section, a.i) -
        effectiveLoggedAtMs(b.e, dateKey, section, b.i)
    )
    .map((x) => x.e);
}

export type TimedFoodRow = {
  entry: FoodEntry;
  section: MealSection;
  indexInSection: number;
};

export function allEntriesChronological(day: DayFoodLog, dateKey: string): TimedFoodRow[] {
  const out: TimedFoodRow[] = [];
  for (const section of MEAL_SECTION_ORDER) {
    day[section].forEach((entry, indexInSection) => {
      out.push({ entry, section, indexInSection });
    });
  }
  out.sort(
    (a, b) =>
      effectiveLoggedAtMs(a.entry, dateKey, a.section, a.indexInSection) -
      effectiveLoggedAtMs(b.entry, dateKey, b.section, b.indexInSection)
  );
  return out;
}

export function dayBoundsMs(dateKey: string): { start: number; end: number } {
  const d = parseDateKeyLocal(dateKey);
  return { start: startOfDay(d).getTime(), end: endOfDay(d).getTime() };
}

export function todayDateKey(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function maxAllowedLoggedAtMs(dateKey: string): number {
  const todayKey = todayDateKey();
  const { end } = dayBoundsMs(dateKey);
  if (dateKey === todayKey) {
    return Math.min(end, Date.now());
  }
  return end;
}

export function clampLoggedAtMs(dateKey: string, ms: number): number {
  const { start, end } = dayBoundsMs(dateKey);
  const max = maxAllowedLoggedAtMs(dateKey);
  return Math.min(Math.max(ms, start), max);
}

export function defaultLogTimeForAdd(dateKey: string, section: MealSection): Date {
  const max = maxAllowedLoggedAtMs(dateKey);
  const suggested = defaultLoggedAtMs(dateKey, section);
  return new Date(Math.min(suggested, max));
}

export function scaleEntryAmount(entry: FoodEntry, newAmount: number): FoodEntry {
  const prev = entry.amount > 0 ? entry.amount : 1;
  const r = newAmount / prev;
  return {
    ...entry,
    amount: Math.round(newAmount * 10) / 10,
    calories: Math.round(entry.calories * r),
    protein: Math.round(entry.protein * r * 10) / 10,
    carbs: Math.round(entry.carbs * r * 10) / 10,
    fat: Math.round(entry.fat * r * 10) / 10,
  };
}
