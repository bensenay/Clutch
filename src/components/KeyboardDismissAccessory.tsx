import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../theme/theme';

export const KEYBOARD_DISMISS_ACCESSORY_ID = 'clutch-keyboard-dismiss';

export function KeyboardDismissAccessory() {
  const { t } = useTranslation();

  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <InputAccessoryView nativeID={KEYBOARD_DISMISS_ACCESSORY_ID}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          onPress={Keyboard.dismiss}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{t('common.done')}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: 'flex-end',
    backgroundColor: colors.rinkSurface,
    borderTopColor: colors.frostSteel,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  buttonText: {
    color: colors.iceWhite,
    fontSize: 16,
    fontWeight: '800',
  },
});
