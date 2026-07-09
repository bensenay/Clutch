import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from 'react-native';
import { useTranslation } from 'react-i18next';
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
      <Button
        title={t('landing.signIn')}
        onPress={() => navigation.navigate('SignIn')}
      />
      <Button
        title={t('landing.createAccount')}
        onPress={() => navigation.navigate('AccountType')}
      />
      <Button
        title={nextLanguage.toUpperCase()}
        onPress={() => void setLanguage(nextLanguage)}
      />
    </AuthScreen>
  );
}
