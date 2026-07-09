import type { PropsWithChildren, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={styles.container}
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
    </KeyboardAvoidingView>
  );
}

type FormFieldProps = TextInputProps & {
  label: string;
};

export function FormField({ label, style, ...props }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        placeholderTextColor="#7d8794"
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

export const authStyles = StyleSheet.create({
  error: {
    color: '#b42318',
    lineHeight: 20,
  },
  note: {
    color: '#59636e',
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
    backgroundColor: '#f4f6f3',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  content: {
    alignSelf: 'center',
    gap: 12,
    maxWidth: 480,
    width: '100%',
  },
  eyebrow: {
    color: '#b8442f',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: '#15251f',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  description: {
    color: '#59636e',
    fontSize: 16,
    lineHeight: 23,
  },
  form: {
    gap: 16,
    marginTop: 12,
  },
  field: {
    gap: 7,
  },
  label: {
    color: '#25332e',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#ccd3ce',
    borderRadius: 10,
    borderWidth: 1,
    color: '#15251f',
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
});
