import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  type ActiveTeam,
  useActiveTeam,
} from '../teams/ActiveTeamContext';
import { appScreenStyles } from './AppScreen';
import { colors, goalRed, slateGrey } from '../theme/theme';

type TeamSwitcherProps = {
  teams: ActiveTeam[];
};

export function TeamSwitcher({ teams }: TeamSwitcherProps) {
  const { t } = useTranslation();
  const { activeTeam, setActiveTeam } = useActiveTeam();

  if (teams.length <= 1) {
    return null;
  }

  return (
    <View style={appScreenStyles.card}>
      <Text style={appScreenStyles.cardTitle}>
        {t('teamSwitcher.title')}
      </Text>
      <Text style={appScreenStyles.cardDescription}>
        {t('teamSwitcher.description')}
      </Text>
      <View style={styles.options}>
        {teams.map((team) => {
          const isActive = activeTeam?.id === team.id;

          return (
            <Pressable
              accessibilityRole="button"
              key={team.id}
              onPress={() => setActiveTeam(team)}
              style={[styles.option, isActive && styles.activeOption]}
            >
              <Text
                style={[
                  styles.optionTitle,
                  isActive && styles.activeOptionTitle,
                ]}
              >
                {team.name}
              </Text>
              <Text style={styles.optionMeta}>
                {[team.level, team.season]
                  .filter(Boolean)
                  .join(' / ') || t('teamSwitcher.noDetails')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  activeOption: {
    backgroundColor: colors.cardPressed,
    borderColor: goalRed,
  },
  activeOptionTitle: {
    color: goalRed,
  },
  option: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  optionMeta: {
    color: slateGrey,
    fontSize: 13,
  },
  options: {
    gap: 10,
    marginTop: 4,
  },
  optionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
