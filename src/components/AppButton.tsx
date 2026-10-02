import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  bevel,
  brushed,
  colors,
  goalRed,
  insetShadow,
  radii,
  spacing,
} from '../theme/theme';
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
  const [pressed, setPressed] = useState(false);
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const foregroundColor = isPrimary
    ? colors.textOnDark
    : variant === 'danger'
      ? goalRed
      : colors.textPrimary;
  const gradient = isPrimary
    ? pressed
      ? brushed.accentPressed
      : brushed.accent
    : pressed
      ? brushed.steelPressed
      : brushed.steel;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.base,
        !isGhost && (isPrimary ? bevel.accent : bevel.light),
        isGhost && styles.ghost,
        pressed && !isGhost && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {isGhost ? null : (
        <LinearGradient
          {...gradient}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radii.md }]}
        />
      )}
      {pressed && !isGhost ? (
        <View pointerEvents="none" style={styles.insetLine} />
      ) : null}
      {icon ? <AppIcon color={foregroundColor} name={icon} size={18} /> : null}
      <Text style={[styles.label, { color: foregroundColor }]}>{title}</Text>
    </Pressable>
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
  ghost: {
    backgroundColor: 'transparent',
  },
  insetLine: {
    backgroundColor: insetShadow,
    height: 2,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
  },
  // Pushed in: the lit top edge goes dark and the label sinks a pixel.
  pressed: {
    borderTopColor: '#6E7378',
    paddingTop: spacing.sm + 1,
  },
});
