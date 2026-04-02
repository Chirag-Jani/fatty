import { useFocusEffect } from "@react-navigation/native";
import { format, subDays } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { getStepsLogs, setStepsForDay } from "../storage/storage";
import { COLORS, SPACING } from "../theme";

export function StepsScreen() {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const [stepsToday, setStepsToday] = useState(0);
  const [input, setInput] = useState("");
  const [allLogs, setAllLogs] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const logs = await getStepsLogs();
    setAllLogs(logs);
    setStepsToday(logs[todayKey] ?? 0);
    setInput(String(logs[todayKey] ?? ""));
  }, [todayKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function save() {
    const n = parseInt(input.replace(/\D/g, ""), 10);
    if (Number.isNaN(n) || n < 0) return;
    await setStepsForDay(todayKey, n);
    load();
  }

  const chartData = useMemo(() => {
    const out: { value: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      const v = allLogs[key] ?? 0;
      out.push({
        value: v,
        label: format(d, "EEE"),
      });
    }
    return out;
  }, [allLogs]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={["rgba(255,183,77,0.18)", "rgba(0,0,0,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.headerGlow}
      />
      <Text style={styles.h1}>Steps</Text>
      <Text style={styles.sub}>Quick daily log + simple weekly view</Text>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <Text style={styles.label}>Steps today</Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.textSecondary}
          />
          <PrimaryButton title="Save" onPress={save} />
          <Text style={styles.saved}>Saved: {stepsToday} steps</Text>
        </Card>

        <Card>
          <Text style={styles.chartTitle}>Last 7 days</Text>
          {chartData.some((d) => d.value > 0) ? (
            <BarChart
              data={chartData}
              width={Dimensions.get("window").width - SPACING.md * 4}
              barWidth={22}
              spacing={18}
              roundedTop
              roundedBottom
              hideRules
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: COLORS.textSecondary, fontSize: 10 }}
              xAxisLabelTextStyle={{
                color: COLORS.textSecondary,
                fontSize: 11,
              }}
              noOfSections={4}
              frontColor={COLORS.primary}
            />
          ) : (
            <Text style={styles.empty}>Log steps to see the chart</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  h1: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  sub: {
    paddingHorizontal: SPACING.md,
    paddingTop: 4,
    paddingBottom: SPACING.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: SPACING.xs,
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    marginBottom: SPACING.md,
    color: COLORS.text,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  saved: { marginTop: SPACING.md, color: COLORS.textSecondary },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  empty: { color: COLORS.textSecondary },
});
