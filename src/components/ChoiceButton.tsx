import { Pressable, StyleSheet, Text } from 'react-native';

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
    backgroundColor: '#ffffff',
    borderColor: '#ccd3ce',
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    padding: 18,
  },
  pressed: {
    backgroundColor: '#e7ede8',
  },
  title: {
    color: '#15251f',
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    color: '#59636e',
    fontSize: 14,
    lineHeight: 20,
  },
});
