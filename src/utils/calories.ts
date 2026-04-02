import type { ActivityLevel, Gender, UserProfile, WeeklyLossKg } from '../types';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
};

const DEFICIT_BY_RATE: Record<WeeklyLossKg, number> = {
  0.25: 275,
  0.5: 550,
  1: 1100,
};

export function computeBmr(weightKg: number, heightCm: number, age: number, gender: Gender): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

export function computeTdee(bmr: number, activity: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activity];
}

export function computeDailyCalorieGoal(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender,
  activity: ActivityLevel,
  weeklyLossKg: WeeklyLossKg
): { bmr: number; tdee: number; dailyCalorieGoal: number } {
  const bmr = computeBmr(weightKg, heightCm, age, gender);
  const tdee = computeTdee(bmr, activity);
  const deficit = DEFICIT_BY_RATE[weeklyLossKg];
  const dailyCalorieGoal = Math.round(tdee - deficit);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), dailyCalorieGoal };
}

export function buildProfileFromInputs(
  partial: Omit<UserProfile, 'bmr' | 'tdee' | 'dailyCalorieGoal' | 'onboardingComplete'> & {
    onboardingComplete?: boolean;
  }
): UserProfile {
  const { bmr, tdee, dailyCalorieGoal } = computeDailyCalorieGoal(
    partial.currentWeightKg,
    partial.heightCm,
    partial.age,
    partial.gender,
    partial.activity,
    partial.weeklyLossKg
  );
  return {
    ...partial,
    bmr,
    tdee,
    dailyCalorieGoal,
    onboardingComplete: partial.onboardingComplete ?? true,
  };
}

export function scaleFromPer100g(
  per100: {
    kcalPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    fatPer100g: number;
  },
  grams: number
): { calories: number; protein: number; carbs: number; fat: number } {
  const g = Math.max(0, grams);
  const f = g / 100;
  return {
    calories: Math.round(per100.kcalPer100g * f),
    protein: Math.round(per100.proteinPer100g * f * 10) / 10,
    carbs: Math.round(per100.carbsPer100g * f * 10) / 10,
    fat: Math.round(per100.fatPer100g * f * 10) / 10,
  };
}

export function estimateCaloriesBurnedFromSteps(input: {
  steps: number;
  heightCm: number;
  weightKg: number;
}): number {
  const steps = Math.max(0, Math.floor(input.steps || 0));
  const heightCm = Math.max(0, input.heightCm || 0);
  const weightKg = Math.max(0, input.weightKg || 0);
  if (!steps || !heightCm || !weightKg) return 0;

  // Simple offline estimate:
  // - stride length ≈ 0.415 * height
  // - calories ≈ weightKg * distanceKm * 0.75 (rough walking average)
  const strideM = (heightCm * 0.415) / 100;
  const distanceKm = (steps * strideM) / 1000;
  const kcal = weightKg * distanceKm * 0.75;
  return Math.round(Math.max(0, kcal));
}
