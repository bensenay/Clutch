import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, goalRed, radii, spacing } from '../theme/theme';
import { AnimatedPressable } from './AnimatedPressable';
import { AppIcon, type AppIconName } from './AppIcon';

type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type AppButtonProps = {
  disabled?: boolean;
  icon?: AppIconName;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  title: string;
  variant?: AppButtonVariant;
};

export function AppButton({
  disabled,
  icon,
  onPress,
  style,
  title,
  variant = 'primary',
}: AppButtonProps) {
  const foregroundColor =
    variant === 'primary' || variant === 'danger'
      ? colors.textOnDark
      : variant === 'secondary'
        ? colors.textPrimary
        : goalRed;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <AppIcon color={foregroundColor} name={icon} size={18} /> : null}
      <Text style={[styles.label, { color: foregroundColor }]}>{title}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  disabled: {
    opacity: 0.45,
  },
  danger: {
    backgroundColor: goalRed,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
  },
  primary: {
    backgroundColor: goalRed,
  },
  secondary: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderWidth: 1,
  },
});
