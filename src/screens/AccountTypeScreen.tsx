import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AuthScreen, authStyles } from '../components/AuthScreen';
import { ChoiceButton } from '../components/ChoiceButton';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'AccountType'>;

export function AccountTypeScreen({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <AuthScreen
      description={t('accountType.description')}
      title={t('accountType.title')}
    >
      <View style={authStyles.choiceList}>
        <ChoiceButton
          description={t('accountType.directorDescription')}
          title={t('accountType.directorTitle')}
          onPress={() => navigation.navigate('DirectorSignup')}
        />
        <ChoiceButton
          description={t('accountType.coachDescription')}
          title={t('accountType.coachTitle')}
          onPress={() => navigation.navigate('CoachPath')}
        />
      </View>
    </AuthScreen>
  );
}
