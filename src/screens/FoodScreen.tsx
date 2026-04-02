import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  LayoutAnimation,
  Platform,
  Pressable,
  UIManager,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { COLORS, RADIUS, SPACING } from '../theme';
import type { DayFoodLog, FoodEntry, FoodTemplate, MealSection } from '../types';
import {
  addFoodEntry,
  getDayFoodLog,
  getFoodTemplates,
  removeFoodEntry,
} from '../storage/storage';
import { createId } from '../utils/id';

const SECTIONS: { key: MealSection; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];

function MealBlock({
  entries,
  onDelete,
}: {
  entries: FoodEntry[];
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <View style={styles.mealSection}>
        <Text style={styles.emptyMeal}>No items</Text>
      </View>
    );
  }
  return (
    <View style={styles.mealSection}>
      {entries.map((e) => (
        <View key={e.id} style={styles.foodRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.foodName}>{e.name}</Text>
            <Text style={styles.foodMeta}>
              {e.amount}{e.amountUnit} · P {e.protein} · C {e.carbs} · F {e.fat}
            </Text>
          </View>
          <Text style={styles.cal}>{e.calories} kcal</Text>
          <Pressable onPress={() => onDelete(e.id)} hitSlop={8}>
            <Text style={styles.del}>✕</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export function FoodScreen() {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [day, setDay] = useState<DayFoodLog | null>(null);
  const [mealForAdd, setMealForAdd] = useState<MealSection>('breakfast');
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const addSheetAnim = useRef(new Animated.Value(0)).current;
  const [templatesById, setTemplatesById] = useState<Record<string, FoodTemplate>>({});
  const templates = useMemo(() => Object.values(templatesById).sort((a, b) => b.createdAt - a.createdAt), [templatesById]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const selectedTemplate = selectedTemplateId ? templatesById[selectedTemplateId] : null;
  const [amount, setAmount] = useState('100');

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const load = useCallback(async () => {
    const d = await getDayFoodLog(todayKey);
    setDay(d);
  }, [todayKey]);

  const loadTemplates = useCallback(async () => {
    const t = await getFoodTemplates();
    setTemplatesById(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadTemplates();
    }, [load])
  );

  function showAddSheet(meal: MealSection) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMealForAdd(meal);
    setSelectedTemplateId(templates.length ? templates[0].id : null);
    setAmount('100');
    setAddSheetVisible(true);
    addSheetAnim.setValue(0);
    Animated.timing(addSheetAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }

  function closeAddSheet() {
    Animated.timing(addSheetAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setAddSheetVisible(false);
    });
  }

  const totals = day
    ? [...day.breakfast, ...day.lunch, ...day.dinner, ...day.snacks].reduce(
        (a, e) => ({
          cal: a.cal + e.calories,
          p: a.p + e.protein,
          c: a.c + e.carbs,
          f: a.f + e.fat,
        }),
        { cal: 0, p: 0, c: 0, f: 0 }
      )
    : { cal: 0, p: 0, c: 0, f: 0 };

  async function addSelectedToLog() {
    if (!selectedTemplate) return;
    const a = parseFloat(amount.replace(',', '.')) || 0;
    if (!a || a <= 0) return;

    const f = a / 100;
    const entry: FoodEntry = {
      id: createId(),
      name: selectedTemplate.name,
      calories: Math.round(selectedTemplate.kcalPer100 * f),
      protein: Math.round(selectedTemplate.proteinPer100 * f * 10) / 10,
      carbs: Math.round(selectedTemplate.carbsPer100 * f * 10) / 10,
      fat: Math.round(selectedTemplate.fatPer100 * f * 10) / 10,
      amount: Math.round(a * 10) / 10,
      amountUnit: selectedTemplate.amountUnit,
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await addFoodEntry(todayKey, mealForAdd, entry);
    await load();
    closeAddSheet();
  }

  async function onDelete(section: MealSection, id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await removeFoodEntry(todayKey, section, id);
    load();
  }

  if (!day) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Food" subtitle={todayKey} accent="green" />
      <ScrollView contentContainerStyle={styles.scroll}>

        <Card>
          <Text style={styles.totLabel}>Today</Text>
          <Text style={styles.totCal}>{Math.round(totals.cal)} kcal</Text>
          <Text style={styles.totMacro}>
            P {Math.round(totals.p * 10) / 10} g · C {Math.round(totals.c * 10) / 10} g · F{' '}
            {Math.round(totals.f * 10) / 10} g
          </Text>
        </Card>

        {SECTIONS.map(({ key, label }) => (
          <Card key={key}>
            <View style={styles.mealHeader}>
              <Text style={styles.mealH2}>{label}</Text>
              <Pressable style={styles.addBtn} onPress={() => showAddSheet(key)}>
                <Text style={styles.addBtnText}>+ Add</Text>
              </Pressable>
            </View>
            <MealBlock entries={day[key]} onDelete={(id) => onDelete(key, id)} />
          </Card>
        ))}
      </ScrollView>

      <Modal
        visible={addSheetVisible}
        transparent
        animationType="none"
        onRequestClose={closeAddSheet}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Animated.View
            style={[
              styles.modalBox,
              {
                opacity: addSheetAnim,
                transform: [
                  {
                    translateY: addSheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.modalTop}>
              <Text style={styles.modalTitle}>Add food · {mealForAdd}</Text>
              <View style={styles.modalTopRight}>
                <Pressable onPress={closeAddSheet} style={styles.closeBtn}>
                  <Text style={styles.close}>Close</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetScroll}>
              {templates.length ? (
                <View style={styles.templateList}>
                  <Text style={styles.sectionTitle}>Your default foods</Text>
                  <FlatList
                    data={templates}
                    keyExtractor={(t) => t.id}
                    scrollEnabled={false}
                    nestedScrollEnabled
                    renderItem={({ item }) => {
                      const on = item.id === selectedTemplateId;
                      return (
                        <Pressable
                          onPress={() => setSelectedTemplateId(item.id)}
                          style={[styles.tRow, on && styles.tRowOn]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.tName}>{item.name}</Text>
                            <Text style={styles.tMeta}>
                              {Math.round(item.kcalPer100)} kcal / 100{item.amountUnit} · P {item.proteinPer100} · C{' '}
                              {item.carbsPer100} · F {item.fatPer100}
                            </Text>
                          </View>
                          <Text style={styles.tPick}>{on ? 'Selected' : ''}</Text>
                        </Pressable>
                      );
                    }}
                  />
                </View>
              ) : (
                <View style={styles.emptyTemplates}>
                  <Text style={styles.emptyTxt}>No default foods yet.</Text>
                  <Text style={styles.emptySub}>Create some in the “Defaults” tab, then add them here.</Text>
                </View>
              )}

              <View style={styles.form}>
                <Text style={styles.label}>
                  Amount ({selectedTemplate?.amountUnit ?? 'g'})
                </Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
                <View style={styles.addRow}>
                  <PrimaryButton
                    title="Add to log"
                    onPress={addSelectedToLog}
                    disabled={!selectedTemplate || templates.length === 0}
                  />
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, paddingBottom: 120 },
  totLabel: { fontSize: 14, color: COLORS.textSecondary },
  totCal: { fontSize: 32, fontWeight: '700', color: COLORS.primaryDark },
  totMacro: { marginTop: SPACING.xs, fontSize: 15, color: COLORS.text },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  mealH2: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  addBtn: {
    backgroundColor: COLORS.chipSelectedBg,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
  },
  addBtnText: { color: COLORS.primary, fontWeight: '700' },
  mealSection: { marginTop: SPACING.sm },
  emptyMeal: { color: COLORS.textSecondary, fontSize: 14 },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  foodName: { fontSize: 16, color: COLORS.text },
  foodMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cal: { fontWeight: '600', color: COLORS.text, marginRight: SPACING.sm },
  del: { fontSize: 18, color: COLORS.textSecondary, padding: SPACING.xs },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.md,
    maxHeight: '92%',
  },
  sheetScroll: { paddingBottom: 16 },
  modalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTopRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  close: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  closeBtn: { padding: SPACING.xs },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary, marginBottom: SPACING.sm },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: SPACING.md,
    color: COLORS.text,
  },
  label: { fontSize: 14, fontWeight: '600', marginBottom: SPACING.xs, color: COLORS.text },

  templateList: { marginBottom: SPACING.md },
  emptyTemplates: { paddingVertical: SPACING.md },
  emptyTxt: { fontSize: 16, color: COLORS.text, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },

  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  tRowOn: { backgroundColor: COLORS.chipSelectedBg },
  tName: { fontSize: 16, color: COLORS.text, fontWeight: '700' },
  tMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  tPick: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  form: { paddingTop: SPACING.sm },
  addRow: { marginTop: SPACING.sm },

});
