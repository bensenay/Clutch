import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AuthScreen, authStyles } from '../components/AuthScreen';
import { ChoiceButton } from '../components/ChoiceButton';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'CoachPath'>;

export function CoachPathScreen({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <AuthScreen
      description={t('coachPath.description')}
      title={t('coachPath.title')}
    >
      <View style={authStyles.choiceList}>
        <ChoiceButton
          description={t('coachPath.joinDescription')}
          title={t('coachPath.joinTitle')}
          onPress={() => navigation.navigate('JoinOrganization')}
        />
        <ChoiceButton
          description={t('coachPath.independentDescription')}
          title={t('coachPath.independentTitle')}
          onPress={() => navigation.navigate('IndependentCoachSignup')}
        />
      </View>
    </AuthScreen>
  );
}
