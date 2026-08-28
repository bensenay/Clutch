import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/theme';
import { AppIcon, type AppIconName } from './AppIcon';
import { appScreenStyles } from './AppScreen';

type EmptyStateProps = {
  action?: ReactNode;
  description: string;
  icon: AppIconName;
  title: string;
};

export function EmptyState({
  action,
  description,
  icon,
  title,
}: EmptyStateProps) {
  return (
    <View style={[appScreenStyles.card, styles.container]}>
      <View style={styles.iconBadge}>
        <AppIcon color={colors.goalRed} name={icon} size={26} />
      </View>
      <Text style={[appScreenStyles.cardTitle, styles.title]}>{title}</Text>
      <Text style={[appScreenStyles.cardDescription, styles.description]}>
        {description}
      </Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    marginTop: spacing.xs,
  },
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  description: {
    maxWidth: 360,
    textAlign: 'center',
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  title: {
    textAlign: 'center',
  },
});
