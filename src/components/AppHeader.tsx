import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import {
  colors,
  fonts,
  iceWhite,
  radii,
  rinkNavy,
  spacing,
} from '../theme/theme';
import { AnimatedPressable } from './AnimatedPressable';
import { AppIcon } from './AppIcon';

type Navigation = NativeStackNavigationProp<AuthenticatedStackParamList>;

export function HeaderMenuButton() {
  const { t } = useTranslation();
  const navigation = useNavigation<Navigation>();
  const { activeTeam, role } = useActiveTeam();
  const [visible, setVisible] = useState(false);

  function navigate(route: 'Dashboard' | 'DirectorAssistantCoaches' | 'DrillLibrary' | 'SchoolDrillLibrary') {
    setVisible(false);
    navigation.navigate(route);
  }

  return (
    <>
      <AnimatedPressable
        accessibilityLabel={t('appMenu.openLabel')}
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={styles.headerButton}
      >
        <AppIcon color={iceWhite} name="ellipsis-horizontal" size={25} />
      </AnimatedPressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <SafeAreaView style={styles.modalRoot}>
          <Pressable
            accessibilityLabel={t('common.close')}
            onPress={() => setVisible(false)}
            style={styles.backdrop}
          />
          <View accessibilityViewIsModal style={styles.menuPanel}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>{t('appMenu.title')}</Text>
              <Pressable
                accessibilityLabel={t('common.close')}
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setVisible(false)}
              >
                <AppIcon name="close" />
              </Pressable>
            </View>
            <MenuItem
              icon="speedometer-outline"
              label={t('appMenu.dashboard')}
              onPress={() => navigate('Dashboard')}
            />
            {role === 'director' ? (
              <MenuItem
                icon="people-circle-outline"
                label={t('appMenu.coachManager')}
                onPress={() => navigate('DirectorAssistantCoaches')}
              />
            ) : null}
            {role !== 'super_admin' ? (
              <MenuItem
                icon="library-outline"
                label={t('appMenu.drillLibrary')}
                onPress={() => navigate(activeTeam ? 'DrillLibrary' : 'SchoolDrillLibrary')}
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

export function HeaderTeamSelector() {
  const { t } = useTranslation();
  const {
    activeTeam,
    isAllTeams,
    isLoadingTeams,
    role,
    selectAllTeams,
    setActiveTeam,
    teams,
  } = useActiveTeam();
  const [visible, setVisible] = useState(false);
  const label = isLoadingTeams
    ? t('common.loading')
    : isAllTeams
      ? t('teamSwitcher.allTeams')
      : activeTeam?.name ?? t('teamSwitcher.noTeamSelected');

  return (
    <>
      <Pressable
        accessibilityLabel={t('teamSwitcher.openLabel', { teamName: label })}
        accessibilityRole="button"
        disabled={isLoadingTeams || (teams.length < 2 && role !== 'director')}
        onPress={() => setVisible(true)}
        style={styles.teamTrigger}
      >
        <Text numberOfLines={1} style={styles.teamTriggerText}>{label}</Text>
        <AppIcon color={iceWhite} name="chevron-down" size={16} />
      </Pressable>
      <Modal
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        transparent
        visible={visible}
      >
        <SafeAreaView style={styles.modalRoot}>
          <Pressable onPress={() => setVisible(false)} style={styles.backdrop} />
          <View accessibilityViewIsModal style={styles.selectorPanel}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>{t('teamSwitcher.title')}</Text>
              <Pressable
                accessibilityLabel={t('common.close')}
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setVisible(false)}
              >
                <AppIcon name="close" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.teamList}>
              {role === 'director' ? (
                <TeamOption
                  active={isAllTeams}
                  label={t('teamSwitcher.allTeams')}
                  onPress={() => {
                    selectAllTeams();
                    setVisible(false);
                  }}
                />
              ) : null}
              {teams.map((team) => (
                <TeamOption
                  active={activeTeam?.id === team.id}
                  key={team.id}
                  label={team.name}
                  meta={[team.level, team.season].filter(Boolean).join(' / ')}
                  onPress={() => {
                    setActiveTeam(team);
                    setVisible(false);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: Parameters<typeof AppIcon>[0]['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable accessibilityRole="button" onPress={onPress} style={styles.menuItem}>
      <AppIcon name={icon} />
      <Text style={styles.menuItemText}>{label}</Text>
      <AppIcon name="chevron-forward" size={18} />
    </AnimatedPressable>
  );
}

function TeamOption({
  active,
  label,
  meta,
  onPress,
}: {
  active: boolean;
  label: string;
  meta?: string;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.teamOption, active && styles.teamOptionActive]}
    >
      <View style={styles.teamOptionCopy}>
        <Text numberOfLines={1} style={styles.menuItemText}>{label}</Text>
        {meta ? <Text style={styles.teamMeta}>{meta}</Text> : null}
      </View>
      {active ? <AppIcon name="checkmark-circle" /> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(3, 13, 24, 0.68)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  headerButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  menuHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  menuItem: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  menuItemText: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  menuPanel: {
    backgroundColor: colors.card,
    borderBottomRightRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxWidth: 330,
    minHeight: 260,
    padding: spacing.xl,
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '82%',
  },
  menuTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.display,
    fontSize: 24,
  },
  modalRoot: {
    flex: 1,
  },
  selectorPanel: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    bottom: 0,
    gap: spacing.xs,
    maxHeight: '72%',
    padding: spacing.xl,
    position: 'absolute',
    width: '100%',
  },
  teamMeta: {
    color: colors.slateGrey,
    fontSize: 13,
  },
  teamList: { gap: spacing.xs },
  teamOption: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    padding: spacing.md,
  },
  teamOptionActive: {
    backgroundColor: colors.cardPressed,
    borderColor: colors.goalRed,
  },
  teamOptionCopy: {
    flex: 1,
  },
  teamTrigger: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: 220,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  teamTriggerText: {
    color: iceWhite,
    flexShrink: 1,
    fontFamily: fonts.display,
    fontSize: 18,
  },
});
