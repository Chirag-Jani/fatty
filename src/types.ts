export type Gender = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active';

export type WeeklyLossKg = 0.25 | 0.5 | 1;

export interface UserProfile {
  name: string;
  age: number;
  gender: Gender;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  activity: ActivityLevel;
  weeklyLossKg: WeeklyLossKg;
  bmr: number;
  tdee: number;
  dailyCalorieGoal: number;
  onboardingComplete: boolean;
}

export type MealSection = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type FoodAmountUnit = 'g' | 'ml';

export interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  amount: number;
  amountUnit: FoodAmountUnit;
}

export interface FoodTemplate {
  id: string;
  name: string;
  amountUnit: FoodAmountUnit; // 'g' for edible (per 100g), 'ml' for drinkable (per 100ml)
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  createdAt: number;
}

export interface DayFoodLog {
  breakfast: FoodEntry[];
  lunch: FoodEntry[];
  dinner: FoodEntry[];
  snacks: FoodEntry[];
}

export type FoodLogsByDate = Record<string, DayFoodLog>;
export type FoodTemplatesById = Record<string, FoodTemplate>;
export type WaterLogsByDate = Record<string, number>;
export type StepsLogsByDate = Record<string, number>;
export type WeightLogsByDate = Record<string, number>;

export interface OffProductNutriments {
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  code?: string;
}
