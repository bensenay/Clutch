import type { PropsWithChildren, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import {
  colors,
  fonts,
  goalRed,
  radii,
  slateGrey,
  spacing,
} from '../theme/theme';
import { RinkWatermark } from './RinkWatermark';
import {
  KEYBOARD_DISMISS_ACCESSORY_ID,
  KeyboardDismissAccessory,
} from './KeyboardDismissAccessory';

type AuthScreenProps = PropsWithChildren<{
  title: string;
  description?: string;
  footer?: ReactNode;
}>;

export function AuthScreen({
  title,
  description,
  footer,
  children,
}: AuthScreenProps) {
  const { t } = useTranslation();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <RinkWatermark />
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={styles.container}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.eyebrow}>{t('common.brand')}</Text>
          <Text style={styles.title}>{title}</Text>
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
          <View style={styles.form}>{children}</View>
          {footer}
        </View>
      </ScrollView>
      <KeyboardDismissAccessory />
    </KeyboardAvoidingView>
  );
}

type FormFieldProps = TextInputProps & {
  label: string;
};

export function FormField({
  label,
  multiline = false,
  onSubmitEditing,
  style,
  ...props
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        blurOnSubmit={!multiline}
        inputAccessoryViewID={
          Platform.OS === 'ios' ? KEYBOARD_DISMISS_ACCESSORY_ID : undefined
        }
        multiline={multiline}
        onSubmitEditing={(event) => {
          if (!multiline) {
            Keyboard.dismiss();
          }
          onSubmitEditing?.(event);
        }}
        placeholderTextColor={slateGrey}
        returnKeyType={multiline ? 'default' : 'done'}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

type AuthFooterLinkProps = {
  onPress: () => void;
};

export function AuthFooterLink({ onPress }: AuthFooterLinkProps) {
  const { t } = useTranslation();

  function handlePress() {
    try {
      onPress();
    } catch (error) {
      console.error('Unable to navigate from auth footer.', error);
    }
  }

  return (
    <Pressable style={styles.footerLink} onPress={handlePress}>
      <Text style={styles.footerText}>
        {t('authFooter.alreadyHaveAccount')}{' '}
        <Text style={styles.footerAction}>{t('authFooter.signIn')}</Text>
      </Text>
    </Pressable>
  );
}

export const authStyles = StyleSheet.create({
  error: {
    color: goalRed,
    lineHeight: 20,
  },
  note: {
    color: colors.frostSteel,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  choiceList: {
    gap: 12,
  },
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.rinkNavy,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  content: {
    alignSelf: 'center',
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
  },
  eyebrow: {
    color: colors.hornAmber,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0,
  },
  description: {
    color: colors.frostSteel,
    fontSize: 16,
    lineHeight: 23,
  },
  form: {
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.frostSteel,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.fieldBackground,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  footerAction: {
    color: colors.hornAmber,
    fontWeight: '700',
  },
  footerLink: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  footerText: {
    color: colors.frostSteel,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
