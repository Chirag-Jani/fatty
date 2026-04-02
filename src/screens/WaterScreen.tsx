import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { COLORS, RADIUS, SPACING } from '../theme';
import { addWaterMl, getWaterMl, setWaterMl } from '../storage/storage';

const DAILY_GOAL_ML = 2500;
const QUICK = [250, 500, 1000];

export function WaterScreen() {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [ml, setMlState] = useState(0);
  const [custom, setCustom] = useState('');

  const load = useCallback(async () => {
    const w = await getWaterMl(todayKey);
    setMlState(w);
  }, [todayKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function add(amount: number) {
    await addWaterMl(todayKey, amount);
    load();
  }

  async function applyCustom() {
    const v = parseInt(custom.replace(/\D/g, ''), 10);
    if (!v || v <= 0) return;
    await addWaterMl(todayKey, v);
    setCustom('');
    load();
  }

  async function setTotal() {
    const v = parseInt(custom.replace(/\D/g, ''), 10);
    if (Number.isNaN(v) || v < 0) return;
    await setWaterMl(todayKey, v);
    setCustom('');
    load();
  }

  const pct = Math.min(100, (ml / DAILY_GOAL_ML) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.h1}>Water</Text>
      <Text style={styles.sub}>Goal {DAILY_GOAL_ML} ml per day</Text>

      <Card>
        <Text style={styles.big}>{ml}</Text>
        <Text style={styles.unit}>ml logged today</Text>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.rem}>{Math.max(0, DAILY_GOAL_ML - ml)} ml to goal</Text>
      </Card>

      <Text style={styles.sec}>Quick add</Text>
      <View style={styles.row}>
        {QUICK.map((q) => (
          <Pressable key={q} style={styles.qBtn} onPress={() => add(q)}>
            <Text style={styles.qTxt}>
              {q >= 1000 ? `${q / 1000} L` : `${q} ml`}
            </Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <Text style={styles.label}>Add amount (ml)</Text>
        <TextInput
          style={styles.input}
          value={custom}
          onChangeText={setCustom}
          keyboardType="number-pad"
          placeholder="e.g. 300"
          placeholderTextColor={COLORS.textSecondary}
        />
        <Pressable style={styles.rowBtns} onPress={applyCustom}>
          <Text style={styles.primaryBtn}>Add to total</Text>
        </Pressable>
        <Pressable style={styles.rowBtns} onPress={setTotal}>
          <Text style={styles.secondaryBtn}>Set total for today</Text>
        </Pressable>
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.md },
  h1: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  sub: { color: COLORS.textSecondary, marginBottom: SPACING.md },
  big: { fontSize: 48, fontWeight: '700', color: COLORS.water },
  unit: { fontSize: 16, color: COLORS.textSecondary, marginBottom: SPACING.md },
  barBg: {
    height: 14,
    backgroundColor: COLORS.border,
    borderRadius: 7,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: COLORS.water, borderRadius: 7 },
  rem: { marginTop: SPACING.sm, fontSize: 15, color: COLORS.text },
  sec: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  qBtn: {
    flexGrow: 1,
    minWidth: '28%',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  qTxt: { fontSize: 17, fontWeight: '700', color: COLORS.primaryDark },
  label: { fontSize: 14, fontWeight: '600', marginBottom: SPACING.xs },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 14,
    fontSize: 17,
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  rowBtns: { paddingVertical: SPACING.sm },
  primaryBtn: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 17,
    textAlign: 'center',
  },
  secondaryBtn: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
  },
});
