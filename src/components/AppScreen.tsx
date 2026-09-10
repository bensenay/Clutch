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
        <View style={styles.headerRule} />
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
    padding: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
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
    gap: spacing.md,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  content: {
    alignSelf: 'center',
    gap: spacing.lg,
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
    gap: spacing.sm,
    marginBottom: spacing.xl,
    maxWidth: 560,
    width: '100%',
  },
  headerRule: {
    backgroundColor: goalRed,
    borderRadius: 2,
    height: 3,
    marginTop: spacing.xs,
    width: 42,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0,
  },
});
