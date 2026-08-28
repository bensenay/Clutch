import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { appScreenStyles } from './AppScreen';
import { colors, goalRed, radii, spacing } from '../theme/theme';

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ActivityIndicator color={goalRed} />
      <Text style={appScreenStyles.note}>{label ?? t('common.loading')}</Text>
      <View style={styles.skeleton} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  skeleton: {
    backgroundColor: colors.cardPressed,
    borderRadius: radii.pill,
    height: 8,
    width: '62%',
  },
});
