import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
        styles.btn,
        dim && styles.btnDisabled,
        pressed && !dim && styles.pressed,
        style,
      ]}
      disabled={dim}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
  },
  text: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
