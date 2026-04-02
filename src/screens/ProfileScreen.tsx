import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { useUser } from "../context/UserContext";
import { COLORS, SPACING } from "../theme";
import type { ActivityLevel, Gender, WeeklyLossKg } from "../types";
import {
  exportBackup,
  getLastBackupAt,
  pickAndImportBackup,
} from "../utils/backup";
import { buildProfileFromInputs } from "../utils/calories";
import {
  disableDailyBackupReminder,
  getReminderEnabled,
  scheduleDailyBackupReminderAt21,
} from "../utils/reminders";

const GENDERS: { key: Gender; label: string }[] = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
];

const ACTIVITIES: { key: ActivityLevel; label: string }[] = [
  { key: "sedentary", label: "Sedentary" },
  { key: "lightly_active", label: "Lightly active" },
  { key: "moderately_active", label: "Moderately active" },
  { key: "very_active", label: "Very active" },
];

const RATES: { key: WeeklyLossKg; label: string }[] = [
  { key: 0.25, label: "0.25 kg/week" },
  { key: 0.5, label: "0.5 kg/week" },
  { key: 1, label: "1 kg/week" },
];

function ChipRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <Pressable
              key={String(o.key)}
              onPress={() => onChange(o.key)}
              style={[styles.chip, selected && styles.chipSelected]}
              hitSlop={8}
            >
              <Text style={[styles.chipTxt, selected && styles.chipTxtOn]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { profile, setProfile } = useUser();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [heightCm, setHeightCm] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [activity, setActivity] = useState<ActivityLevel>("lightly_active");
  const [weeklyLoss, setWeeklyLoss] = useState<WeeklyLossKg>(0.5);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [reminderEnabled, setReminderEnabledState] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setAge(String(profile.age));
    setGender(profile.gender);
    setHeightCm(String(profile.heightCm));
    setCurrentWeight(String(profile.currentWeightKg));
    setTargetWeight(String(profile.targetWeightKg));
    setActivity(profile.activity);
    setWeeklyLoss(profile.weeklyLossKg);
  }, [profile]);

  useEffect(() => {
    (async () => {
      const [lb, re] = await Promise.all([
        getLastBackupAt(),
        getReminderEnabled(),
      ]);
      setLastBackupAt(lb);
      setReminderEnabledState(re);
    })();
  }, []);

  const lastBackupLabel = useMemo(() => {
    if (!lastBackupAt) return "Never";
    try {
      return format(new Date(lastBackupAt), "EEE, d MMM · HH:mm");
    } catch {
      return "—";
    }
  }, [lastBackupAt]);

  async function onSave() {
    if (!profile) return;
    setError(null);
    const ageN = parseInt(age, 10);
    const h = parseFloat(heightCm.replace(",", "."));
    const cw = parseFloat(currentWeight.replace(",", "."));
    const tw = parseFloat(targetWeight.replace(",", "."));
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!ageN || ageN < 10 || ageN > 120) {
      setError("Enter a valid age.");
      return;
    }
    if (!h || h < 100 || h > 250) {
      setError("Enter height between 100 and 250 cm.");
      return;
    }
    if (!cw || cw < 30 || cw > 300) {
      setError("Enter a valid current weight (kg).");
      return;
    }
    if (!tw || tw < 30 || tw > 300) {
      setError("Enter a valid target weight (kg).");
      return;
    }
    setSaving(true);
    try {
      const next = buildProfileFromInputs({
        name: name.trim(),
        age: ageN,
        gender,
        heightCm: h,
        currentWeightKg: cw,
        targetWeightKg: tw,
        activity,
        weeklyLossKg: weeklyLoss,
        onboardingComplete: true,
      });
      await setProfile(next);
    } finally {
      setSaving(false);
    }
  }

  async function onExport() {
    setBackupStatus(null);
    setBackupBusy(true);
    try {
      await exportBackup();
      const lb = await getLastBackupAt();
      setLastBackupAt(lb);
      setBackupStatus("Backup exported.");
    } catch (e) {
      setBackupStatus("Export failed.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function onImport() {
    setBackupStatus(null);
    setBackupBusy(true);
    try {
      await pickAndImportBackup();
      setBackupStatus(
        "Backup imported. Restart the app if something looks outdated.",
      );
    } catch (e: any) {
      if (String(e?.message) === "CANCELLED") {
        // no-op
      } else {
        setBackupStatus("Import failed. Make sure it’s a valid JSON backup.");
      }
    } finally {
      setBackupBusy(false);
    }
  }

  async function toggleReminder() {
    setBackupStatus(null);
    setBackupBusy(true);
    try {
      if (reminderEnabled) {
        await disableDailyBackupReminder();
        setReminderEnabledState(false);
        setBackupStatus("Daily reminder disabled.");
      } else {
        await scheduleDailyBackupReminderAt21();
        setReminderEnabledState(true);
        setBackupStatus("Daily 9pm reminder enabled.");
      }
    } catch (e: any) {
      if (String(e?.message) === "NOTIFICATIONS_NOT_SUPPORTED_IN_EXPO_GO") {
        setBackupStatus(
          "Daily reminders require a development/standalone build (not Expo Go).",
        );
      } else if (String(e?.message) === "NOTIFICATIONS_DENIED") {
        setBackupStatus("Notifications permission denied.");
      } else {
        setBackupStatus("Could not update reminder.");
      }
    } finally {
      setBackupBusy(false);
    }
  }

  if (!profile) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <LinearGradient
        colors={["rgba(76,175,80,0.18)", "rgba(0,0,0,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.headerGlow}
      />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Profile</Text>
          <Text style={styles.sub}>
            {`Daily goal: ${profile.dailyCalorieGoal} kcal (BMR ${profile.bmr}, TDEE ${profile.tdee})`}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Card>
            <Text style={styles.sectionTitle}>Backup & restore</Text>
            <Text style={styles.muted}>Last backup: {lastBackupLabel}</Text>
            <View style={styles.actionsRow}>
              <Pressable
                style={styles.iconAction}
                onPress={onExport}
                disabled={backupBusy}
              >
                <Ionicons name="share-outline" size={18} color={COLORS.text} />
                <Text style={styles.iconActionTxt}>Export</Text>
              </Pressable>
              <Pressable
                style={styles.iconAction}
                onPress={onImport}
                disabled={backupBusy}
              >
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={COLORS.text}
                />
                <Text style={styles.iconActionTxt}>Import</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.reminderRow}
              onPress={toggleReminder}
              disabled={backupBusy}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.reminderTitle}>Daily reminder</Text>
                <Text style={styles.muted}>Every day at 9:00 PM</Text>
              </View>
              <View style={[styles.pill, reminderEnabled && styles.pillOn]}>
                <Text
                  style={[styles.pillTxt, reminderEnabled && styles.pillTxtOn]}
                >
                  {reminderEnabled ? "On" : "Off"}
                </Text>
              </View>
            </Pressable>

            {backupStatus ? (
              <Text style={styles.status}>{backupStatus}</Text>
            ) : null}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Basics</Text>
            <View style={styles.grid2}>
              <View style={styles.gridCol}>
                <Text style={styles.sectionLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.sectionLabel}>Age</Text>
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  placeholder="Years"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>
            <ChipRow
              label="Gender"
              options={GENDERS}
              value={gender}
              onChange={setGender}
            />
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Body</Text>
            <View style={styles.grid2}>
              <View style={styles.gridCol}>
                <Text style={styles.sectionLabel}>Height (cm)</Text>
                <TextInput
                  style={styles.input}
                  value={heightCm}
                  onChangeText={setHeightCm}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 175"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.sectionLabel}>Current (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={currentWeight}
                  onChangeText={setCurrentWeight}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 80"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            <Text style={styles.sectionLabel}>Target weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={targetWeight}
              onChangeText={setTargetWeight}
              keyboardType="decimal-pad"
              placeholder="e.g. 72"
              placeholderTextColor={COLORS.textSecondary}
            />
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Goal</Text>
            <ChipRow
              label="Activity level"
              options={ACTIVITIES}
              value={activity}
              onChange={setActivity}
            />
            <ChipRow
              label="Weight loss rate"
              options={RATES}
              value={weeklyLoss}
              onChange={setWeeklyLoss}
            />
          </Card>

          {error ? <Text style={styles.err}>{error}</Text> : null}

          <PrimaryButton
            title="Save & recalculate goal"
            onPress={onSave}
            loading={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  headerGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 240 },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  h1: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  sub: {
    paddingTop: 4,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 6,
  },
  muted: { color: COLORS.textSecondary, lineHeight: 18 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: SPACING.md },
  iconAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  iconActionTxt: { color: COLORS.text, fontWeight: "900", letterSpacing: 0.2 },
  reminderRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  reminderTitle: { color: COLORS.text, fontWeight: "900" },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    minWidth: 56,
    alignItems: "center",
  },
  pillOn: {
    backgroundColor: COLORS.chipSelectedBg,
    borderColor: COLORS.primaryDark,
  },
  pillTxt: { color: COLORS.textSecondary, fontWeight: "900" },
  pillTxtOn: { color: COLORS.primary },
  status: { marginTop: SPACING.md, color: COLORS.textSecondary },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  grid2: { flexDirection: "row", gap: 10 },
  gridCol: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: 17,
    color: COLORS.text,
    marginBottom: SPACING.md,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  field: { marginBottom: SPACING.md },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  chipSelected: {
    backgroundColor: COLORS.chipSelectedBg,
    borderColor: COLORS.primaryDark,
  },
  chipTxt: { color: COLORS.textSecondary, fontWeight: "900" },
  chipTxtOn: { color: COLORS.primary, fontWeight: "900" },
  err: { color: COLORS.error, marginBottom: SPACING.md },
});
