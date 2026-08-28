import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AppButton } from '../components/AppButton';
import { AuthScreen } from '../components/AuthScreen';
import { setLanguage } from '../i18n';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

export function LandingScreen({ navigation }: Props) {
  const { i18n, t } = useTranslation();
  const nextLanguage = i18n.resolvedLanguage === 'fr' ? 'en' : 'fr';

  return (
    <AuthScreen
      description={t('landing.description')}
      title={t('landing.title')}
    >
      <AppButton
        icon="log-in-outline"
        title={t('landing.signIn')}
        onPress={() => navigation.navigate('SignIn')}
      />
      <AppButton
        icon="rocket-outline"
        title={t('landing.createAccount')}
        onPress={() => navigation.navigate('AccountType')}
      />
      <AppButton
        icon="language-outline"
        title={nextLanguage.toUpperCase()}
        onPress={() => void setLanguage(nextLanguage)}
        variant="secondary"
      />
    </AuthScreen>
  );
}
