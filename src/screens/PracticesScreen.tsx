import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import type { AuthenticatedTabParamList } from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';

type Props = BottomTabScreenProps<AuthenticatedTabParamList, 'PracticesTab'>;

export function PracticesScreen(_props: Props) {
  const { t } = useTranslation();
  const { activeTeam } = useActiveTeam();

  return (
    <AppScreen
      description={
        activeTeam
          ? t('practices.description', { teamName: activeTeam.name })
          : t('practices.noActiveTeamDescription')
      }
      title={t('practices.title')}
    >
      <View style={appScreenStyles.card}>
        <Text style={appScreenStyles.cardTitle}>
          {t('practices.emptyTitle')}
        </Text>
        <Text style={appScreenStyles.cardDescription}>
          {t('practices.emptyDescription')}
        </Text>
      </View>
    </AppScreen>
  );
}
