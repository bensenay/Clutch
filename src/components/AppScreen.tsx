import type { PropsWithChildren, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

type AppScreenProps = PropsWithChildren<{
  title: string;
  description?: string;
  action?: ReactNode;
}>;

export function AppScreen({
  title,
  description,
  action,
  children,
}: AppScreenProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t('common.brand')}</Text>
        <Text style={styles.title}>{title}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
        {action}
      </View>
      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
}

export const appScreenStyles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#ccd3ce',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  cardDescription: {
    color: '#59636e',
    fontSize: 14,
    lineHeight: 20,
  },
  cardTitle: {
    color: '#15251f',
    fontSize: 18,
    fontWeight: '700',
  },
  error: {
    color: '#b42318',
    lineHeight: 20,
  },
  list: {
    gap: 12,
  },
  meta: {
    color: '#59636e',
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    color: '#59636e',
    fontSize: 14,
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f4f6f3',
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  content: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 560,
    width: '100%',
  },
  description: {
    color: '#59636e',
    fontSize: 16,
    lineHeight: 23,
  },
  eyebrow: {
    color: '#b8442f',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  header: {
    alignSelf: 'center',
    gap: 10,
    marginBottom: 22,
    maxWidth: 560,
    width: '100%',
  },
  title: {
    color: '#15251f',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
});
