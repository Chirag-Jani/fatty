import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING } from '../theme';

export function ScreenHeader({
  title,
  subtitle,
  accent = 'green',
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  accent?: 'green' | 'water' | 'purple' | 'orange' | 'blue';
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  const accentColor =
    accent === 'water'
      ? COLORS.water
      : accent === 'purple'
        ? COLORS.fat
        : accent === 'orange'
          ? COLORS.carbs
          : accent === 'blue'
            ? COLORS.protein
            : COLORS.primary;

  return (
    <View style={[styles.wrap, style]}>
      <LinearGradient
        colors={[`${accentColor}38`, 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.glow}
      />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 240 },
  row: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.text, letterSpacing: 0.2 },
  sub: { color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 },
  right: { alignItems: 'flex-end' },
});

