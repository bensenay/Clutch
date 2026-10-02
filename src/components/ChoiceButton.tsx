import { StyleSheet, Text, View } from 'react-native';
import { bevel, colors, radii, slateGrey, spacing } from '../theme/theme';
import { AnimatedPressable } from './AnimatedPressable';
import { AppIcon, type AppIconName } from './AppIcon';

type ChoiceButtonProps = {
  description: string;
  icon?: AppIconName;
  onPress: () => void;
  title: string;
};

export function ChoiceButton({
  description,
  icon,
  onPress,
  title,
}: ChoiceButtonProps) {
  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.button}
      surface
    >
      <View style={styles.header}>
        {icon ? (
          <View style={styles.iconBadge}>
            <AppIcon color={colors.textPrimary} name={icon} size={20} />
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.description}>{description}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    ...bevel.light,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    color: slateGrey,
    fontSize: 14,
    lineHeight: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: colors.cardPressed,
    borderRadius: radii.sm,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
});
