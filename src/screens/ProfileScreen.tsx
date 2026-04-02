import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { COLORS, SPACING } from '../theme';
import type { ActivityLevel, Gender, WeeklyLossKg } from '../types';
import { buildProfileFromInputs } from '../utils/calories';
import { useUser } from '../context/UserContext';

const GENDERS: { key: Gender; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
];

const ACTIVITIES: { key: ActivityLevel; label: string }[] = [
  { key: 'sedentary', label: 'Sedentary' },
  { key: 'lightly_active', label: 'Lightly active' },
  { key: 'moderately_active', label: 'Moderately active' },
  { key: 'very_active', label: 'Very active' },
];

const RATES: { key: WeeklyLossKg; label: string }[] = [
  { key: 0.25, label: '0.25 kg/week' },
  { key: 0.5, label: '0.5 kg/week' },
  { key: 1, label: '1 kg/week' },
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
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <Text
              key={String(o.key)}
              onPress={() => onChange(o.key)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              {o.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const { profile, setProfile } = useUser();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [heightCm, setHeightCm] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel>('lightly_active');
  const [weeklyLoss, setWeeklyLoss] = useState<WeeklyLossKg>(0.5);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function onSave() {
    if (!profile) return;
    setError(null);
    const ageN = parseInt(age, 10);
    const h = parseFloat(heightCm.replace(',', '.'));
    const cw = parseFloat(currentWeight.replace(',', '.'));
    const tw = parseFloat(targetWeight.replace(',', '.'));
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!ageN || ageN < 10 || ageN > 120) {
      setError('Enter a valid age.');
      return;
    }
    if (!h || h < 100 || h > 250) {
      setError('Enter height between 100 and 250 cm.');
      return;
    }
    if (!cw || cw < 30 || cw > 300) {
      setError('Enter a valid current weight (kg).');
      return;
    }
    if (!tw || tw < 30 || tw > 300) {
      setError('Enter a valid target weight (kg).');
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

  if (!profile) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenHeader
          title="Profile"
          subtitle={`Daily goal: ${profile.dailyCalorieGoal} kcal (BMR ${profile.bmr}, TDEE ${profile.tdee})`}
          accent="blue"
        />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            placeholder="Years"
            placeholderTextColor={COLORS.textSecondary}
          />

          <ChipRow label="Gender" options={GENDERS} value={gender} onChange={setGender} />

          <Text style={styles.label}>Height (cm)</Text>
          <TextInput
            style={styles.input}
            value={heightCm}
            onChangeText={setHeightCm}
            keyboardType="decimal-pad"
            placeholder="e.g. 175"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Current weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={currentWeight}
            onChangeText={setCurrentWeight}
            keyboardType="decimal-pad"
            placeholder="e.g. 80"
            placeholderTextColor={COLORS.textSecondary}
          />

          <Text style={styles.label}>Target weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={targetWeight}
            onChangeText={setTargetWeight}
            keyboardType="decimal-pad"
            placeholder="e.g. 72"
            placeholderTextColor={COLORS.textSecondary}
          />

          <ChipRow
            label="Activity level"
            options={ACTIVITIES}
            value={activity}
            onChange={setActivity}
          />

          <ChipRow
            label="Desired weight loss rate"
            options={RATES}
            value={weeklyLoss}
            onChange={setWeeklyLoss}
          />

          {error ? <Text style={styles.err}>{error}</Text> : null}

          <PrimaryButton title="Save & recalculate goal" onPress={onSave} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: 17,
    color: COLORS.text,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  field: { marginBottom: SPACING.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    fontSize: 15,
    color: COLORS.text,
  },
  chipSelected: {
    backgroundColor: COLORS.chipSelectedBg,
    borderColor: COLORS.primaryDark,
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  err: { color: COLORS.error, marginBottom: SPACING.md },
});
