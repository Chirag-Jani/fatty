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
import { addDays, format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { COLORS, RADIUS, SPACING } from '../theme';
import type { DayFoodLog, FoodEntry, FoodTemplate, MealSection } from '../types';
import { Ionicons } from '@expo/vector-icons';
import {
  addFoodEntry,
  getDayFoodLog,
  getFoodTemplates,
  getStepsForDay,
  removeFoodEntry,
  updateFoodEntry,
} from '../storage/storage';
import { createId } from '../utils/id';
import { estimateCaloriesBurnedFromSteps } from '../utils/calories';
import { useUser } from '../context/UserContext';
import {
  allEntriesChronological,
  clampLoggedAtMs,
  dayBoundsMs,
  defaultLogTimeForAdd,
  effectiveLoggedAtMs,
  maxAllowedLoggedAtMs,
  parseDateKeyLocal,
  sortEntriesByTime,
  scaleEntryAmount,
  todayDateKey,
} from '../utils/foodTime';

const SECTIONS: { key: MealSection; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];

const SECTION_LABEL: Record<MealSection, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snack',
};

function MealBlock({
  entries,
  dateKey,
  section,
  onDelete,
  onPressEntry,
}: {
  entries: FoodEntry[];
  dateKey: string;
  section: MealSection;
  onDelete: (id: string) => void;
  onPressEntry: (section: MealSection, entry: FoodEntry) => void;
}) {
  const sorted = sortEntriesByTime(entries, dateKey, section);
  if (sorted.length === 0) {
    return (
      <View style={styles.mealSection}>
        <Text style={styles.emptyMeal}>No items</Text>
      </View>
    );
  }
  return (
    <View style={styles.mealSection}>
      {sorted.map((e) => {
        const origIdx = entries.indexOf(e);
        const t = effectiveLoggedAtMs(e, dateKey, section, origIdx >= 0 ? origIdx : 0);
        const timeLabel = format(new Date(t), 'HH:mm');
        return (
          <View key={e.id} style={styles.foodRow}>
            <Pressable style={{ flex: 1 }} onPress={() => onPressEntry(section, e)}>
              <Text style={styles.foodTime}>{timeLabel}</Text>
              <Text style={styles.foodName}>{e.name}</Text>
              <Text style={styles.foodMeta}>
                {e.amount}
                {e.amountUnit} · P {e.protein} · C {e.carbs} · F {e.fat}
              </Text>
            </Pressable>
            <Text style={styles.cal}>{e.calories} kcal</Text>
            <Pressable onPress={() => onDelete(e.id)} hitSlop={8}>
              <Text style={styles.del}>✕</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function FoodScreen() {
  const { profile } = useUser();
  const todayKey = todayDateKey();
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [day, setDay] = useState<DayFoodLog | null>(null);
  const [stepsDay, setStepsDay] = useState(0);
  const [viewMode, setViewMode] = useState<'meals' | 'timeline'>('meals');
  const [mealForAdd, setMealForAdd] = useState<MealSection>('breakfast');
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const addSheetAnim = useRef(new Animated.Value(0)).current;
  const [templatesById, setTemplatesById] = useState<Record<string, FoodTemplate>>({});
  const templates = useMemo(
    () => Object.values(templatesById).sort((a, b) => b.createdAt - a.createdAt),
    [templatesById]
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const selectedTemplate = selectedTemplateId ? templatesById[selectedTemplateId] : null;
  const [amount, setAmount] = useState('100');
  const [logTime, setLogTime] = useState(() => new Date());

  const [androidAddTimeOpen, setAndroidAddTimeOpen] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editTime, setEditTime] = useState(() => new Date());
  const [editSection, setEditSection] = useState<MealSection>('breakfast');
  const [editOriginalSection, setEditOriginalSection] = useState<MealSection>('breakfast');
  const [androidEditTimeOpen, setAndroidEditTimeOpen] = useState(false);

  useEffect(() => {
    if (!selectedTemplate) return;
    setAmount(selectedTemplate.amountUnit === 'pcs' ? '1' : '100');
  }, [selectedTemplateId]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const canGoNext = selectedDateKey < todayKey;

  const goPrevDay = useCallback(() => {
    setSelectedDateKey(format(addDays(parseDateKeyLocal(selectedDateKey), -1), 'yyyy-MM-dd'));
  }, [selectedDateKey]);

  const goNextDay = useCallback(() => {
    if (!canGoNext) return;
    setSelectedDateKey(format(addDays(parseDateKeyLocal(selectedDateKey), 1), 'yyyy-MM-dd'));
  }, [selectedDateKey, canGoNext]);

  const goToday = useCallback(() => {
    setSelectedDateKey(todayDateKey());
  }, []);

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([
      getDayFoodLog(selectedDateKey),
      getStepsForDay(selectedDateKey),
    ]);
    setDay(d);
    setStepsDay(s);
  }, [selectedDateKey]);

  const loadTemplates = useCallback(async () => {
    const t = await getFoodTemplates();
    setTemplatesById(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadTemplates();
    }, [load, loadTemplates])
  );

  function showAddSheet(meal: MealSection) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMealForAdd(meal);
    const firstId = templates.length ? templates[0].id : null;
    setSelectedTemplateId(firstId);
    const first = firstId ? templatesById[firstId] : null;
    setAmount(first?.amountUnit === 'pcs' ? '1' : '100');
    setLogTime(defaultLogTimeForAdd(selectedDateKey, meal));
    setAddSheetVisible(true);
    addSheetAnim.setValue(0);
    Animated.timing(addSheetAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }

  function closeAddSheet() {
    setAndroidAddTimeOpen(false);
    Animated.timing(addSheetAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setAddSheetVisible(false);
    });
  }

  function openEdit(section: MealSection, entry: FoodEntry) {
    const idx = day?.[section]?.findIndex((e) => e.id === entry.id) ?? 0;
    const t = effectiveLoggedAtMs(entry, selectedDateKey, section, Math.max(0, idx));
    setEditOriginalSection(section);
    setEditingEntry(entry);
    setEditAmount(String(entry.amount));
    setEditTime(new Date(t));
    setEditSection(section);
    setEditVisible(true);
  }

  function closeEdit() {
    setAndroidEditTimeOpen(false);
    setEditVisible(false);
    setEditingEntry(null);
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

  const stepsBurnKcal =
    profile && stepsDay
      ? estimateCaloriesBurnedFromSteps({
          steps: stepsDay,
          heightCm: profile.heightCm,
          weightKg: profile.currentWeightKg,
        })
      : 0;
  const goal = profile?.dailyCalorieGoal ?? 0;
  const adjustedGoal = goal + stepsBurnKcal;
  const remaining = Math.max(0, adjustedGoal - totals.cal);

  const maxLogMs = maxAllowedLoggedAtMs(selectedDateKey);
  const { start: dayStartMs } = dayBoundsMs(selectedDateKey);
  const minLogDate = new Date(dayStartMs);
  const maxLogDate = new Date(maxLogMs);

  async function addSelectedToLog() {
    if (!selectedTemplate) return;
    const a = parseFloat(amount.replace(',', '.')) || 0;
    if (!a || a <= 0) return;

    const f = selectedTemplate.amountUnit === 'pcs' ? a : a / 100;
    const loggedAt = clampLoggedAtMs(selectedDateKey, logTime.getTime());
    const entry: FoodEntry = {
      id: createId(),
      name: selectedTemplate.name,
      calories: Math.round(selectedTemplate.kcalPer100 * f),
      protein: Math.round(selectedTemplate.proteinPer100 * f * 10) / 10,
      carbs: Math.round(selectedTemplate.carbsPer100 * f * 10) / 10,
      fat: Math.round(selectedTemplate.fatPer100 * f * 10) / 10,
      amount: Math.round(a * 10) / 10,
      amountUnit: selectedTemplate.amountUnit,
      loggedAt,
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await addFoodEntry(selectedDateKey, mealForAdd, entry);
    await load();
    closeAddSheet();
  }

  async function onDelete(section: MealSection, id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await removeFoodEntry(selectedDateKey, section, id);
    load();
  }

  async function saveEdit() {
    if (!editingEntry) return;
    const a = parseFloat(editAmount.replace(',', '.')) || 0;
    if (a <= 0) return;
    let next = scaleEntryAmount(editingEntry, a);
    const at = clampLoggedAtMs(selectedDateKey, editTime.getTime());
    next = { ...next, loggedAt: at };
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await updateFoodEntry(selectedDateKey, editingEntry.id, {
      ...next,
      section: editSection,
    });
    await load();
    closeEdit();
  }

  const timelineRows = day ? allEntriesChronological(day, selectedDateKey) : [];

  const dateTitle =
    selectedDateKey === todayKey
      ? 'Today'
      : format(parseDateKeyLocal(selectedDateKey), 'EEE, MMM d, yyyy');

  if (!day) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient
        colors={['rgba(76,175,80,0.18)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.headerGlow}
      />
      <Text style={styles.h1}>Food</Text>

      <View style={styles.dateRow}>
        <Pressable onPress={goPrevDay} style={styles.dateNavBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </Pressable>
        <View style={styles.dateCenter}>
          <Text style={styles.dateMain}>{dateTitle}</Text>
          <Text style={styles.sub}>{selectedDateKey}</Text>
        </View>
        <Pressable
          onPress={goNextDay}
          style={[styles.dateNavBtn, !canGoNext && styles.dateNavDisabled]}
          disabled={!canGoNext}
          hitSlop={12}
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={canGoNext ? COLORS.primary : COLORS.textSecondary}
          />
        </Pressable>
      </View>
      {selectedDateKey !== todayKey ? (
        <Pressable onPress={goToday} style={styles.todayChip}>
          <Text style={styles.todayChipText}>Jump to today</Text>
        </Pressable>
      ) : null}

      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setViewMode('meals')}
          style={[styles.modeChip, viewMode === 'meals' && styles.modeChipOn]}
        >
          <Text style={[styles.modeChipText, viewMode === 'meals' && styles.modeChipTextOn]}>
            By meal
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('timeline')}
          style={[styles.modeChip, viewMode === 'timeline' && styles.modeChipOn]}
        >
          <Text style={[styles.modeChipText, viewMode === 'timeline' && styles.modeChipTextOn]}>
            Daily log
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <Text style={styles.totLabel}>{selectedDateKey === todayKey ? 'Today' : 'Day'} total</Text>
          <Text style={styles.totCal}>{Math.round(totals.cal)} kcal</Text>
          <Text style={styles.totMacro}>
            P {Math.round(totals.p * 10) / 10} g · C {Math.round(totals.c * 10) / 10} g · F{' '}
            {Math.round(totals.f * 10) / 10} g
          </Text>
          {goal > 0 && selectedDateKey === todayKey ? (
            <Text style={styles.totSub}>
              {totals.cal <= adjustedGoal
                ? `${Math.round(remaining)} kcal remaining`
                : `${Math.round(totals.cal - adjustedGoal)} kcal over goal`}
              {stepsBurnKcal > 0 ? ` (includes +${stepsBurnKcal} from steps)` : ''}
            </Text>
          ) : null}
        </Card>

        {viewMode === 'timeline' ? (
          <Card>
            <Text style={styles.mealH2}>Daily log</Text>
            <Text style={styles.timelineHint}>All items by time for this date.</Text>
            {timelineRows.length === 0 ? (
              <Text style={styles.emptyMeal}>Nothing logged yet.</Text>
            ) : (
              timelineRows.map(({ entry, section, indexInSection }) => {
                const t = effectiveLoggedAtMs(entry, selectedDateKey, section, indexInSection);
                const timeLabel = format(new Date(t), 'HH:mm');
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() => openEdit(section, entry)}
                    style={styles.timelineRow}
                  >
                    <View style={styles.timelineLeft}>
                      <Text style={styles.timelineTime}>{timeLabel}</Text>
                      <Text style={styles.timelineSection}>{SECTION_LABEL[section]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.foodName}>{entry.name}</Text>
                      <Text style={styles.foodMeta}>
                        {entry.amount}
                        {entry.amountUnit} · P {entry.protein} · C {entry.carbs} · F {entry.fat}
                      </Text>
                    </View>
                    <Text style={styles.cal}>{entry.calories} kcal</Text>
                  </Pressable>
                );
              })
            )}
          </Card>
        ) : (
          SECTIONS.map(({ key, label }) => (
            <Card key={key}>
              <View style={styles.mealHeader}>
                <Text style={styles.mealH2}>{label}</Text>
                <Pressable style={styles.addBtn} onPress={() => showAddSheet(key)}>
                  <Text style={styles.addBtnText}>+ Add</Text>
                </Pressable>
              </View>
              <MealBlock
                entries={day[key]}
                dateKey={selectedDateKey}
                section={key}
                onDelete={(id) => onDelete(key, id)}
                onPressEntry={openEdit}
              />
            </Card>
          ))
        )}
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
              <View style={styles.timeBlock}>
                <Text style={styles.label}>Time logged</Text>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={logTime}
                    mode="time"
                    display="spinner"
                    themeVariant="dark"
                    minimumDate={minLogDate}
                    maximumDate={maxLogDate}
                    onChange={(_, d) => {
                      if (d)
                        setLogTime(new Date(clampLoggedAtMs(selectedDateKey, d.getTime())));
                    }}
                  />
                ) : (
                  <>
                    <Pressable
                      style={styles.timePressable}
                      onPress={() => setAndroidAddTimeOpen(true)}
                    >
                      <Text style={styles.timePressableText}>{format(logTime, 'HH:mm')}</Text>
                      <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                    </Pressable>
                    {androidAddTimeOpen ? (
                      <DateTimePicker
                        value={logTime}
                        mode="time"
                        display="default"
                        onChange={(ev, d) => {
                          setAndroidAddTimeOpen(false);
                          if (ev.type === 'dismissed' || !d) return;
                          setLogTime(new Date(clampLoggedAtMs(selectedDateKey, d.getTime())));
                        }}
                      />
                    ) : null}
                  </>
                )}
              </View>

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
                              {Math.round(item.kcalPer100)} kcal /{' '}
                              {item.amountUnit === 'pcs' ? 'piece' : `100${item.amountUnit}`} · P{' '}
                              {item.proteinPer100} · C {item.carbsPer100} · F {item.fatPer100}
                            </Text>
                          </View>
                          <View style={[styles.checkWrap, on && styles.checkWrapOn]}>
                            {on ? (
                              <Ionicons name="checkmark" size={16} color="#0E1210" />
                            ) : (
                              <Ionicons name="ellipse-outline" size={16} color={COLORS.textSecondary} />
                            )}
                          </View>
                        </Pressable>
                      );
                    }}
                  />
                </View>
              ) : (
                <View style={styles.emptyTemplates}>
                  <Text style={styles.emptyTxt}>No default foods yet.</Text>
                  <Text style={styles.emptySub}>
                    Create some in the “Defaults” tab, then add them here.
                  </Text>
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
                  placeholder={selectedTemplate?.amountUnit === 'pcs' ? '1' : '100'}
                  placeholderTextColor={COLORS.textSecondary}
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

      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={closeEdit}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.editModalBox}>
            <Text style={styles.modalTitle}>Edit entry</Text>
            {editingEntry ? (
              <>
                <Text style={styles.editFoodName}>{editingEntry.name}</Text>
                <Text style={styles.label}>Meal type</Text>
                <View style={styles.sectionPickRow}>
                  {SECTIONS.map(({ key, label }) => (
                    <Pressable
                      key={key}
                      onPress={() => setEditSection(key)}
                      style={[styles.secChip, editSection === key && styles.secChipOn]}
                    >
                      <Text
                        style={[styles.secChipText, editSection === key && styles.secChipTextOn]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>Time</Text>
                {Platform.OS === 'ios' ? (
                  <DateTimePicker
                    value={editTime}
                    mode="time"
                    display="spinner"
                    themeVariant="dark"
                    minimumDate={minLogDate}
                    maximumDate={maxLogDate}
                    onChange={(_, d) => {
                      if (d)
                        setEditTime(new Date(clampLoggedAtMs(selectedDateKey, d.getTime())));
                    }}
                  />
                ) : (
                  <>
                    <Pressable
                      style={styles.timePressable}
                      onPress={() => setAndroidEditTimeOpen(true)}
                    >
                      <Text style={styles.timePressableText}>{format(editTime, 'HH:mm')}</Text>
                      <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                    </Pressable>
                    {androidEditTimeOpen ? (
                      <DateTimePicker
                        value={editTime}
                        mode="time"
                        display="default"
                        onChange={(ev, d) => {
                          setAndroidEditTimeOpen(false);
                          if (ev.type === 'dismissed' || !d) return;
                          setEditTime(new Date(clampLoggedAtMs(selectedDateKey, d.getTime())));
                        }}
                      />
                    ) : null}
                  </>
                )}
                <Text style={styles.label}>Amount ({editingEntry.amountUnit})</Text>
                <TextInput
                  style={styles.input}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="decimal-pad"
                  placeholderTextColor={COLORS.textSecondary}
                />
                <View style={styles.editActions}>
                  <PrimaryButton title="Save" onPress={saveEdit} />
                  <Pressable
                    style={styles.deleteEntryBtn}
                    onPress={async () => {
                      if (!editingEntry) return;
                      await removeFoodEntry(selectedDateKey, editOriginalSection, editingEntry.id);
                      await load();
                      closeEdit();
                    }}
                  >
                    <Text style={styles.deleteEntryText}>Delete</Text>
                  </Pressable>
                  <Pressable onPress={closeEdit} style={styles.cancelEditBtn}>
                    <Text style={styles.cancelEditText}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 220 },
  h1: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  dateNavBtn: { padding: SPACING.xs },
  dateNavDisabled: { opacity: 0.4 },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateMain: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  sub: {
    paddingTop: 2,
    color: COLORS.textSecondary,
    lineHeight: 18,
    fontSize: 13,
  },
  todayChip: {
    alignSelf: 'center',
    marginTop: SPACING.sm,
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    backgroundColor: COLORS.chipSelectedBg,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
  },
  todayChipText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  modeRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modeChipOn: {
    backgroundColor: COLORS.chipSelectedBg,
    borderColor: COLORS.primaryDark,
  },
  modeChipText: { color: COLORS.textSecondary, fontWeight: '600' },
  modeChipTextOn: { color: COLORS.primary, fontWeight: '700' },
  scroll: { padding: SPACING.md, paddingBottom: 120 },
  totLabel: { fontSize: 14, color: COLORS.textSecondary },
  totCal: { fontSize: 32, fontWeight: '700', color: COLORS.primaryDark },
  totMacro: { marginTop: SPACING.xs, fontSize: 15, color: COLORS.text },
  totSub: { marginTop: 6, fontSize: 13, color: COLORS.textSecondary },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  mealH2: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  timelineHint: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  timelineLeft: { width: 56 },
  timelineTime: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  timelineSection: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
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
  foodTime: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
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
  editModalBox: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xl,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    maxHeight: '90%',
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
  timeBlock: { marginBottom: SPACING.md },
  timePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
  },
  timePressableText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
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
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    marginBottom: 8,
  },
  tRowOn: { backgroundColor: COLORS.chipSelectedBg, borderWidth: 1, borderColor: COLORS.primaryDark },
  tName: { fontSize: 16, color: COLORS.text, fontWeight: '700' },
  tMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  checkWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  checkWrapOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  form: { paddingTop: SPACING.sm },
  addRow: { marginTop: SPACING.sm },
  editFoodName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  sectionPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  secChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secChipOn: { backgroundColor: COLORS.chipSelectedBg, borderColor: COLORS.primaryDark },
  secChipText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  secChipTextOn: { color: COLORS.primary, fontWeight: '700' },
  editActions: { marginTop: SPACING.md, gap: SPACING.sm },
  deleteEntryBtn: { paddingVertical: 12, alignItems: 'center' },
  deleteEntryText: { color: COLORS.error, fontWeight: '700', fontSize: 16 },
  cancelEditBtn: { paddingVertical: 8, alignItems: 'center' },
  cancelEditText: { color: COLORS.textSecondary, fontWeight: '600' },
});
