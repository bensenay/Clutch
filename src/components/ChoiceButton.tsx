import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, slateGrey } from '../theme/theme';

type ChoiceButtonProps = {
  title: string;
  description: string;
  onPress: () => void;
};

export function ChoiceButton({
  title,
  description,
  onPress,
}: ChoiceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 5,
    padding: 18,
  },
  pressed: {
    backgroundColor: colors.cardPressed,
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
});
