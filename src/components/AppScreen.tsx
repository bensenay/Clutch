import type { PropsWithChildren, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  colors,
  fonts,
  goalRed,
  radii,
  slateGrey,
  spacing,
} from '../theme/theme';

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
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: 18,
  },
  cardDescription: {
    color: slateGrey,
    fontSize: 14,
    lineHeight: 20,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  error: {
    color: goalRed,
    lineHeight: 20,
  },
  list: {
    gap: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  meta: {
    color: slateGrey,
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    color: slateGrey,
    fontSize: 14,
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.rinkNavy,
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
    color: colors.frostSteel,
    fontSize: 16,
    lineHeight: 23,
  },
  eyebrow: {
    color: colors.hornAmber,
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
    color: colors.textOnDark,
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
});
