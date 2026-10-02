import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
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
  shadows,
  slateGrey,
  spacing,
} from '../theme/theme';
import { RinkWatermark } from './RinkWatermark';
import { KeyboardDismissAccessory } from './KeyboardDismissAccessory';

type AppScreenProps = PropsWithChildren<{
  title: string;
  description?: string;
  action?: ReactNode;
  background?: ReactNode;
  contentMaxWidth?: number;
}>;

export function AppScreen({
  title,
  description,
  action,
  background,
  children,
  contentMaxWidth,
}: AppScreenProps) {
  const { t } = useTranslation();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <View pointerEvents="none" style={styles.background}>
        {background ?? <RinkWatermark />}
      </View>
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={styles.container}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.header,
            contentMaxWidth ? { maxWidth: contentMaxWidth } : null,
          ]}
        >
          <Text style={styles.eyebrow}>{t('common.brand')}</Text>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerRule} />
          {description ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
          {action}
        </View>
        <View
          style={[
            styles.content,
            contentMaxWidth ? { maxWidth: contentMaxWidth } : null,
          ]}
        >
          {children}
        </View>
      </ScrollView>
      <KeyboardDismissAccessory />
    </KeyboardAvoidingView>
  );
}

export const appScreenStyles = StyleSheet.create({
  card: {
    ...shadows.subtle,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
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
  flex: {
    backgroundColor: colors.rinkNavy,
    flex: 1,
  },
  background: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  container: {
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
