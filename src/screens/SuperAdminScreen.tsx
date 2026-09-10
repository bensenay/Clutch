import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AppButton } from '../components/AppButton';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { colors, goalRed, spacing } from '../theme/theme';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'SuperAdmin'>;

type SchoolRow = {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  is_personal: boolean;
  created_at: string;
};

export function SuperAdminScreen(_props: Props) {
  const { i18n, t } = useTranslation();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['super-admin-profile', session?.user.id],
    queryFn: async () => {
      if (!session) {
        throw new Error(t('home.noSessionError'));
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error) {
        throw error;
      }

      return data as { role: 'super_admin' | 'director' | 'coach' };
    },
    enabled: Boolean(session),
  });

  const schoolsQuery = useQuery({
    queryKey: ['super-admin-schools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, status, is_personal, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []) as SchoolRow[];
    },
    enabled: profileQuery.data?.role === 'super_admin',
  });

  async function setSchoolStatus(
    school: SchoolRow,
    status: SchoolRow['status'],
  ) {
    const { error } = await supabase
      .from('schools')
      .update({ status })
      .eq('id', school.id);

    if (error) {
      Alert.alert(t('superAdmin.updateErrorTitle'), t('superAdmin.updateError'));
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['super-admin-schools'] });
  }

  function confirmStatusChange(school: SchoolRow) {
    const nextStatus = school.status === 'active' ? 'suspended' : 'active';

    Alert.alert(
      t(`superAdmin.${nextStatus}ConfirmTitle`),
      t(`superAdmin.${nextStatus}ConfirmDescription`, { name: school.name }),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          style: nextStatus === 'suspended' ? 'destructive' : 'default',
          text: t(`superAdmin.${nextStatus}Button`),
          onPress: () => void setSchoolStatus(school, nextStatus),
        },
      ],
    );
  }

  if (profileQuery.isLoading) {
    return (
      <AppScreen title={t('superAdmin.title')}>
        <LoadingState />
      </AppScreen>
    );
  }

  if (profileQuery.data?.role !== 'super_admin') {
    return (
      <AppScreen
        description={t('superAdmin.accessDeniedDescription')}
        title={t('superAdmin.accessDeniedTitle')}
      />
    );
  }

  const schools = schoolsQuery.data ?? [];
  const organizations = schools.filter((school) => !school.is_personal);
  const personalWorkspaceCount = schools.length - organizations.length;

  return (
    <AppScreen
      description={t('superAdmin.description')}
      title={t('superAdmin.title')}
    >
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{organizations.length}</Text>
          <Text style={styles.summaryLabel}>{t('superAdmin.organizationCount')}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{personalWorkspaceCount}</Text>
          <Text style={styles.summaryLabel}>{t('superAdmin.personalCount')}</Text>
        </View>
      </View>
      {schoolsQuery.isLoading ? <LoadingState /> : null}
      {schoolsQuery.error ? (
        <Text style={appScreenStyles.error}>{t('superAdmin.loadError')}</Text>
      ) : null}
      {!schoolsQuery.isLoading && organizations.length === 0 ? (
        <EmptyState
          description={t('superAdmin.emptyDescription')}
          icon="business-outline"
          title={t('superAdmin.emptyTitle')}
        />
      ) : null}
      <View style={appScreenStyles.list}>
        {organizations.map((school) => (
          <View key={school.id} style={appScreenStyles.card}>
            <View style={appScreenStyles.row}>
              <View style={styles.schoolCopy}>
                <Text style={appScreenStyles.cardTitle}>{school.name}</Text>
                <Text style={appScreenStyles.meta}>
                  {new Intl.DateTimeFormat(i18n.language, {
                    dateStyle: 'medium',
                  }).format(new Date(school.created_at))}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  school.status === 'active'
                    ? styles.activeBadge
                    : styles.suspendedBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    school.status === 'active'
                      ? styles.activeText
                      : styles.suspendedText,
                  ]}
                >
                  {t(`superAdmin.statuses.${school.status}`)}
                </Text>
              </View>
            </View>
            <AppButton
              icon={
                school.status === 'active'
                  ? 'pause-circle-outline'
                  : 'checkmark-circle-outline'
              }
              title={
                school.status === 'active'
                  ? t('superAdmin.suspendButton')
                  : t('superAdmin.activateButton')
              }
              variant={school.status === 'active' ? 'secondary' : 'primary'}
              onPress={() => confirmStatusChange(school)}
            />
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  activeBadge: { backgroundColor: colors.successSoft },
  activeText: { color: colors.success },
  schoolCopy: { flex: 1, gap: spacing.xs },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusText: { fontSize: 12, fontWeight: '800' },
  summaryCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  summaryLabel: { color: colors.slateGrey, fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  summaryValue: { color: colors.textPrimary, fontSize: 26, fontWeight: '900' },
  suspendedBadge: { backgroundColor: colors.dangerSoft },
  suspendedText: { color: goalRed },
});
