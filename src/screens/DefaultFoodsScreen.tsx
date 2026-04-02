import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
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
import {
  addFoodTemplate,
  deleteFoodTemplate,
  getFoodTemplates,
  updateFoodTemplate,
} from "../storage/storage";
import { COLORS, RADIUS, SPACING } from "../theme";
import type { FoodAmountUnit, FoodTemplate } from "../types";
import { createId } from "../utils/id";

type FormState = {
  name: string;
  amountUnit: FoodAmountUnit;
  kcalPer100: string;
  proteinPer100: string;
  carbsPer100: string;
  fatPer100: string;
};

const emptyForm = (): FormState => ({
  name: "",
  amountUnit: "g",
  kcalPer100: "",
  proteinPer100: "",
  carbsPer100: "",
  fatPer100: "",
});

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
      hitSlop={8}
    >
      <Text style={[styles.chipTxt, selected && styles.chipTxtOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function DefaultFoodsScreen() {
  const [templatesById, setTemplatesById] = useState<
    Record<string, FoodTemplate>
  >({});
  const templates = useMemo(
    () =>
      Object.values(templatesById).sort((a, b) => b.createdAt - a.createdAt),
    [templatesById],
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const load = useCallback(async () => {
    const t = await getFoodTemplates();
    setTemplatesById(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!sheetOpen) return;
    sheetAnim.setValue(0);
    Animated.timing(sheetAnim, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [sheetOpen, sheetAnim]);

  function openCreate() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode("create");
    setEditingId(null);
    setForm(emptyForm());
    setSheetOpen(true);
  }

  function openEdit(t: FoodTemplate) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode("edit");
    setEditingId(t.id);
    setForm({
      name: t.name,
      amountUnit: t.amountUnit,
      kcalPer100: String(t.kcalPer100),
      proteinPer100: String(t.proteinPer100),
      carbsPer100: String(t.carbsPer100),
      fatPer100: String(t.fatPer100),
    });
    setSheetOpen(true);
  }

  function closeSheet() {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setSheetOpen(false);
    });
  }

  async function save() {
    const name = form.name.trim();
    const kcalPer100 = parseFloat(form.kcalPer100.replace(",", "."));
    const proteinPer100 = parseFloat(form.proteinPer100.replace(",", "."));
    const carbsPer100 = parseFloat(form.carbsPer100.replace(",", "."));
    const fatPer100 = parseFloat(form.fatPer100.replace(",", "."));
    if (!name) return;
    if (
      [kcalPer100, proteinPer100, carbsPer100, fatPer100].some((n) =>
        Number.isNaN(n),
      )
    )
      return;

    const payload: FoodTemplate = {
      id: editingId ?? createId(),
      name,
      amountUnit: form.amountUnit,
      kcalPer100,
      proteinPer100,
      carbsPer100,
      fatPer100,
      createdAt: editingId
        ? (templatesById[editingId]?.createdAt ?? Date.now())
        : Date.now(),
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (mode === "edit" && editingId) {
      await updateFoodTemplate(payload);
    } else {
      await addFoodTemplate(payload);
    }
    await load();
    closeSheet();
  }

  async function remove(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await deleteFoodTemplate(id);
    await load();
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
        <View>
          <Text style={styles.h1}>Default foods</Text>
          <Text style={styles.sub}>Create once. Add daily in seconds.</Text>
        </View>
        <Pressable style={styles.fab} onPress={openCreate} hitSlop={10}>
          <Ionicons name="add" size={22} color="#0E1210" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {templates.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>No default foods yet</Text>
            <Text style={styles.emptySub}>
              Add your most common foods and drinks (grams or ml). Then log them
              from the Food tab.
            </Text>
            <View style={{ height: SPACING.md }} />
            <PrimaryButton
              title="Create first default food"
              onPress={openCreate}
            />
          </Card>
        ) : (
          templates.map((t) => (
            <Card key={t.id}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{t.name}</Text>
                  <Text style={styles.meta}>
                    {Math.round(t.kcalPer100)} kcal / 100{t.amountUnit} · P{" "}
                    {t.proteinPer100} · C {t.carbsPer100} · F {t.fatPer100}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => openEdit(t)}
                    hitSlop={10}
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.iconBtnDanger}
                    onPress={() => remove(t.id)}
                    hitSlop={10}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={COLORS.error}
                    />
                  </Pressable>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Animated.View
            style={[
              styles.sheet,
              {
                opacity: sheetAnim,
                transform: [
                  {
                    translateY: sheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [48, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetTop}>
              <Text style={styles.sheetTitle}>
                {mode === "edit" ? "Edit default food" : "New default food"}
              </Text>
              <Pressable
                onPress={closeSheet}
                hitSlop={10}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetScroll}
            >
              <Text style={styles.label}>Type</Text>
              <View style={styles.chipRow}>
                <Chip
                  label="Edible (g)"
                  selected={form.amountUnit === "g"}
                  onPress={() => setForm((f) => ({ ...f, amountUnit: "g" }))}
                />
                <Chip
                  label="Drinkable (ml)"
                  selected={form.amountUnit === "ml"}
                  onPress={() => setForm((f) => ({ ...f, amountUnit: "ml" }))}
                />
                <Chip
                  label="Pieces"
                  selected={form.amountUnit === "pcs"}
                  onPress={() => setForm((f) => ({ ...f, amountUnit: "pcs" }))}
                />
              </View>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                placeholder="e.g. Milk"
                placeholderTextColor={COLORS.textSecondary}
                returnKeyType="next"
              />

              <Text style={styles.label}>
                {form.amountUnit === "pcs"
                  ? "Calories per piece (kcal)"
                  : `Calories per 100${form.amountUnit} (kcal)`}
              </Text>
              <TextInput
                style={styles.input}
                value={form.kcalPer100}
                onChangeText={(t) => setForm((f) => ({ ...f, kcalPer100: t }))}
                keyboardType="decimal-pad"
                placeholder="e.g. 64"
                placeholderTextColor={COLORS.textSecondary}
              />

              <View style={styles.grid}>
                <View style={styles.gridCol}>
                  <Text style={styles.label}>
                    {form.amountUnit === "pcs"
                      ? "Protein / piece"
                      : `Protein / 100${form.amountUnit}`}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={form.proteinPer100}
                    onChangeText={(t) =>
                      setForm((f) => ({ ...f, proteinPer100: t }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="g"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.label}>
                    {form.amountUnit === "pcs"
                      ? "Carbs / piece"
                      : `Carbs / 100${form.amountUnit}`}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={form.carbsPer100}
                    onChangeText={(t) =>
                      setForm((f) => ({ ...f, carbsPer100: t }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="g"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              </View>

              <Text style={styles.label}>
                {form.amountUnit === "pcs"
                  ? "Fat / piece"
                  : `Fat / 100${form.amountUnit}`}
              </Text>
              <TextInput
                style={styles.input}
                value={form.fatPer100}
                onChangeText={(t) => setForm((f) => ({ ...f, fatPer100: t }))}
                keyboardType="decimal-pad"
                placeholder="g"
                placeholderTextColor={COLORS.textSecondary}
              />

              <PrimaryButton
                title={mode === "edit" ? "Save changes" : "Save default food"}
                onPress={save}
              />
              <View style={{ height: SPACING.lg }} />
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  headerGlow: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h1: { fontSize: 24, fontWeight: "800", color: COLORS.text },
  sub: { color: COLORS.textSecondary, marginTop: 4 },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  scroll: { padding: SPACING.md, paddingBottom: 120 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  emptySub: { marginTop: 6, color: COLORS.textSecondary, lineHeight: 20 },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  name: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  meta: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  actions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconBtnDanger: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,82,82,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,82,82,0.22)",
  },
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.md,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  closeBtn: { padding: 6 },
  sheetScroll: { paddingBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: "rgba(0,0,0,0.18)",
    marginBottom: SPACING.md,
  },
  chipRow: { flexDirection: "row", gap: 10, marginBottom: SPACING.md },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipOn: {
    backgroundColor: COLORS.chipSelectedBg,
    borderColor: COLORS.primaryDark,
  },
  chipTxt: { color: COLORS.textSecondary, fontWeight: "800" },
  chipTxtOn: { color: COLORS.primary, fontWeight: "900" },
  grid: { flexDirection: "row", gap: 10 },
  gridCol: { flex: 1 },
});
