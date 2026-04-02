import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { COLORS, RADIUS, SPACING } from '../theme';
import { addWaterMl, getWaterMl, setWaterMl } from '../storage/storage';

const DAILY_GOAL_ML = 2500;
const QUICK = [250, 500, 1000];

export function WaterScreen() {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [ml, setMlState] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const [editValue, setEditValue] = useState('');

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

  function openSheet() {
    setEditValue(String(ml));
    setSheetOpen(true);
  }

  function closeSheet() {
    Animated.timing(sheetAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setSheetOpen(false);
    });
  }

  useEffect(() => {
    if (!sheetOpen) return;
    sheetAnim.setValue(0);
    Animated.timing(sheetAnim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [sheetOpen, sheetAnim]);

  async function saveTotal() {
    const v = parseInt(editValue.replace(/\D/g, ''), 10);
    if (Number.isNaN(v) || v < 0) return;
    await setWaterMl(todayKey, v);
    await load();
    closeSheet();
  }

  const pct = Math.min(100, (ml / DAILY_GOAL_ML) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient
        colors={['rgba(38,198,218,0.16)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.headerGlow}
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Water</Text>
          <Text style={styles.sub}>Goal {DAILY_GOAL_ML} ml</Text>
        </View>
        <Pressable style={styles.editPill} onPress={openSheet} hitSlop={10}>
          <Ionicons name="create-outline" size={16} color={COLORS.text} />
          <Text style={styles.editPillTxt}>Edit total</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.big}>{ml}</Text>
              <Text style={styles.unit}>ml logged today</Text>
            </View>
            <View style={styles.rightStats}>
              <Text style={styles.smallLbl}>Remaining</Text>
              <Text style={styles.smallVal}>{Math.max(0, DAILY_GOAL_ML - ml)} ml</Text>
              <Text style={[styles.smallLbl, { marginTop: 10 }]}>Progress</Text>
              <Text style={styles.smallVal}>{Math.round(pct)}%</Text>
            </View>
          </View>

          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
        </Card>

        <Text style={styles.sec}>Quick add</Text>
        <View style={styles.row}>
          {QUICK.map((q) => (
            <Pressable key={q} style={styles.qBtn} onPress={() => add(q)}>
              <LinearGradient
                colors={['rgba(38,198,218,0.22)', 'rgba(38,198,218,0.06)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.qGrad}
              />
              <Text style={styles.qTxt}>{q >= 1000 ? `${q / 1000} L` : `${q} ml`}</Text>
              <Text style={styles.qSub}>Tap to add</Text>
            </Pressable>
          ))}
        </View>

        <Card>
          <Text style={styles.hintTitle}>Tip</Text>
          <Text style={styles.hint}>
            Use quick add for speed. Use “Edit total” if you forgot to log earlier and want to set the day’s total in one go.
          </Text>
        </Card>
      </ScrollView>

      <Modal visible={sheetOpen} transparent animationType="none" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                opacity: sheetAnim,
                transform: [
                  {
                    translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetTop}>
              <Text style={styles.sheetTitle}>Today’s total</Text>
              <Pressable onPress={closeSheet} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.sheetSub}>Set the total water you drank today (ml).</Text>
            <TextInput
              style={styles.sheetInput}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="number-pad"
              placeholder="e.g. 1800"
              placeholderTextColor={COLORS.textSecondary}
              autoFocus
            />
            <PrimaryButton title="Save total" onPress={saveTotal} />
            <View style={{ height: SPACING.md }} />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 220 },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  h1: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  sub: { color: COLORS.textSecondary, marginTop: 4 },
  editPill: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editPillTxt: { color: COLORS.text, fontWeight: '800', fontSize: 13 },
  scroll: { padding: SPACING.md, paddingBottom: 120 },
  big: { fontSize: 52, fontWeight: '900', color: COLORS.water },
  unit: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rightStats: { alignItems: 'flex-end' },
  smallLbl: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  smallVal: { color: COLORS.text, fontSize: 16, fontWeight: '900', marginTop: 3 },
  barBg: {
    height: 14,
    backgroundColor: COLORS.border,
    borderRadius: 7,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: COLORS.water, borderRadius: 7 },
  sec: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  qBtn: {
    flexGrow: 1,
    minWidth: '28%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: SPACING.lg - 2,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  qGrad: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  qTxt: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  qSub: { marginTop: 6, fontSize: 12, color: COLORS.textSecondary, fontWeight: '700' },
  hintTitle: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  hint: { marginTop: 8, color: COLORS.textSecondary, lineHeight: 20 },

  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  closeBtn: { padding: 6 },
  sheetSub: { marginTop: 6, marginBottom: SPACING.md, color: COLORS.textSecondary, lineHeight: 18 },
  sheetInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: 20,
    marginBottom: SPACING.md,
    color: COLORS.text,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
});
