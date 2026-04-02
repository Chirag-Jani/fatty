import { useCallback, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { COLORS, SPACING } from '../theme';
import { getWeightLogs, setWeightForDay } from '../storage/storage';

export function WeightScreen() {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [weight, setWeightInput] = useState('');
  const [logs, setLogs] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const w = await getWeightLogs();
    setLogs(w);
    if (w[todayKey] != null) {
      setWeightInput(String(w[todayKey]));
    } else {
      setWeightInput('');
    }
  }, [todayKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function save() {
    const kg = parseFloat(weight.replace(',', '.'));
    if (Number.isNaN(kg) || kg < 20 || kg > 400) return;
    await setWeightForDay(todayKey, Math.round(kg * 10) / 10);
    load();
  }

  const chartPts = useMemo(() => {
    const keys = Object.keys(logs).sort();
    return keys.map((k) => ({
      value: logs[k],
      label: k.slice(5).replace('-', '/'),
      dataPointText: `${logs[k]}`,
    }));
  }, [logs]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Weight</Text>
        <Text style={styles.sub}>Log weight (kg) for {todayKey}</Text>

        <Card>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeightInput}
            keyboardType="decimal-pad"
            placeholder="e.g. 72.5"
            placeholderTextColor={COLORS.textSecondary}
          />
          <PrimaryButton title="Save today" onPress={save} />
        </Card>

        <Card>
          <Text style={styles.chartTitle}>Progress</Text>
          {chartPts.length > 1 ? (
            <LineChart
              data={chartPts}
              width={Dimensions.get('window').width - SPACING.md * 4}
              spacing={56}
              thickness={2}
              color={COLORS.primary}
              hideRules
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: COLORS.textSecondary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: COLORS.textSecondary, fontSize: 9 }}
              dataPointsColor={COLORS.primary}
              dataPointsRadius={4}
              textColor={COLORS.textSecondary}
              textFontSize={10}
              curved
            />
          ) : chartPts.length === 1 ? (
            <Text style={styles.one}>One entry: {chartPts[0].value} kg — add more days for a chart.</Text>
          ) : (
            <Text style={styles.empty}>Log weight to see progress</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  h1: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  sub: { color: COLORS.textSecondary, marginBottom: SPACING.md },
  label: { fontSize: 14, fontWeight: '600', marginBottom: SPACING.xs },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  chartTitle: { fontSize: 16, fontWeight: '600', marginBottom: SPACING.md, color: COLORS.text },
  empty: { color: COLORS.textSecondary },
  one: { color: COLORS.textSecondary, lineHeight: 22 },
});
