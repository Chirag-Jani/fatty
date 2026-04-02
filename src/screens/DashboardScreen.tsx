import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { COLORS, SPACING } from '../theme';
import type { DayFoodLog, FoodEntry } from '../types';
import {
  getDayFoodLog,
  getLatestWeight,
  getStepsForDay,
  getWaterMl,
} from '../storage/storage';
import { useUser } from '../context/UserContext';

function sumDay(day: DayFoodLog) {
  const all: FoodEntry[] = [
    ...day.breakfast,
    ...day.lunch,
    ...day.dinner,
    ...day.snacks,
  ];
  return all.reduce(
    (a, e) => ({
      cal: a.cal + e.calories,
      p: a.p + e.protein,
      c: a.c + e.carbs,
      f: a.f + e.fat,
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );
}

const WATER_GOAL = 2500;

export function DashboardScreen() {
  const { profile } = useUser();
  const [day, setDay] = useState<DayFoodLog | null>(null);
  const [water, setWater] = useState(0);
  const [steps, setSteps] = useState(0);
  const [latestW, setLatestW] = useState<{ dateKey: string; kg: number } | null>(null);
  const [calBarW, setCalBarW] = useState(0);
  const [waterBarW, setWaterBarW] = useState(0);
  const calFillW = useRef(new Animated.Value(0)).current;
  const waterFillW = useRef(new Animated.Value(0)).current;

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const load = useCallback(async () => {
    const [d, w, s, lw] = await Promise.all([
      getDayFoodLog(todayKey),
      getWaterMl(todayKey),
      getStepsForDay(todayKey),
      getLatestWeight(),
    ]);
    setDay(d);
    setWater(w);
    setSteps(s);
    setLatestW(lw);
  }, [todayKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goal = profile?.dailyCalorieGoal ?? 0;
  const totals = day ? sumDay(day) : { cal: 0, p: 0, c: 0, f: 0 };
  const remaining = Math.max(0, goal - totals.cal);
  const pct = goal > 0 ? Math.min(100, (totals.cal / goal) * 100) : 0;
  const waterPct = Math.min(100, (water / WATER_GOAL) * 100);

  useEffect(() => {
    if (!calBarW) return;
    Animated.timing(calFillW, {
      toValue: calBarW * (pct / 100),
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [pct, calBarW, calFillW]);

  useEffect(() => {
    if (!waterBarW) return;
    Animated.timing(waterFillW, {
      toValue: waterBarW * (waterPct / 100),
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [waterPct, waterBarW, waterFillW]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hi}>Hello{profile?.name ? `, ${profile.name}` : ''}</Text>
        <Text style={styles.date}>{format(new Date(), 'EEEE, d MMMM')}</Text>

        <Card>
          <Text style={styles.cardTitle}>Calories</Text>
          <View style={styles.calRow}>
            <Text style={styles.calBig}>{Math.round(totals.cal)}</Text>
            <Text style={styles.calGoal}> / {goal} kcal</Text>
          </View>
          <View
            style={styles.barBg}
            onLayout={(e) => setCalBarW(e.nativeEvent.layout.width)}
          >
            <Animated.View style={[styles.barFill, { width: calFillW }]} />
          </View>
          <Text style={styles.remain}>
            {totals.cal <= goal
              ? `${Math.round(remaining)} kcal remaining`
              : `${Math.round(totals.cal - goal)} kcal over goal`}
          </Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Macros (g)</Text>
          <View style={styles.macroRow}>
            <View style={styles.macroItem}>
              <Text style={[styles.macroVal, { color: COLORS.protein }]}>
                {Math.round(totals.p * 10) / 10}
              </Text>
              <Text style={styles.macroLbl}>Protein</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={[styles.macroVal, { color: COLORS.carbs }]}>
                {Math.round(totals.c * 10) / 10}
              </Text>
              <Text style={styles.macroLbl}>Carbs</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={[styles.macroVal, { color: COLORS.fat }]}>
                {Math.round(totals.f * 10) / 10}
              </Text>
              <Text style={styles.macroLbl}>Fat</Text>
            </View>
          </View>
        </Card>

        <View style={styles.row2}>
          <Card style={styles.half}>
            <Text style={styles.cardTitle}>Water</Text>
            <Text style={styles.statBig}>{Math.round(water)}</Text>
            <Text style={styles.statSub}>ml / {WATER_GOAL} ml</Text>
            <View style={styles.miniBarBg}>
              <View
                style={{ flex: 1 }}
                onLayout={(e) => setWaterBarW(e.nativeEvent.layout.width)}
              >
                <Animated.View style={[styles.miniBar, { width: waterFillW }]} />
              </View>
            </View>
          </Card>
          <Card style={styles.half}>
            <Text style={styles.cardTitle}>Steps</Text>
            <Text style={styles.statBig}>{steps}</Text>
            <Text style={styles.statSub}>today</Text>
          </Card>
        </View>

        <Card>
          <Text style={styles.cardTitle}>Latest weight</Text>
          {latestW ? (
            <>
              <Text style={styles.weightBig}>{latestW.kg.toFixed(1)} kg</Text>
              <Text style={styles.statSub}>{latestW.dateKey}</Text>
            </>
          ) : (
            <Text style={styles.statSub}>No entries yet</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  hi: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  date: { fontSize: 15, color: COLORS.textSecondary, marginBottom: SPACING.md },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.sm },
  calRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: SPACING.sm },
  calBig: { fontSize: 36, fontWeight: '700', color: COLORS.primaryDark },
  calGoal: { fontSize: 18, color: COLORS.textSecondary },
  barBg: {
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },
  remain: { marginTop: SPACING.sm, fontSize: 15, color: COLORS.text },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  macroItem: { alignItems: 'center', flex: 1 },
  macroVal: { fontSize: 22, fontWeight: '700' },
  macroLbl: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  row2: { flexDirection: 'row', gap: SPACING.sm },
  half: { flex: 1, marginBottom: SPACING.md },
  statBig: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  statSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  miniBarBg: {
    marginTop: SPACING.sm,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBar: { height: '100%', backgroundColor: COLORS.water, borderRadius: 3 },
  weightBig: { fontSize: 28, fontWeight: '700', color: COLORS.text },
});
