import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../theme';

type Props = Omit<PressableProps, 'style'> & {
  title: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ title, loading, disabled, style, ...rest }: Props) {
  const dim = disabled || loading;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btnOuter,
        dim && styles.btnDisabled,
        pressed && !dim && styles.pressed,
        style,
      ]}
      disabled={dim}
      {...rest}
    >
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btnInner}
      >
        {loading ? (
          <ActivityIndicator color="#0E1210" />
        ) : (
          <Text style={styles.text}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btnOuter: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    minHeight: 54,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  btnInner: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  text: {
    color: '#0E1210',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
