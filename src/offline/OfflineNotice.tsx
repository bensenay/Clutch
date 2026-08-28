import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { appScreenStyles } from '../components/AppScreen';

export function OfflineNotice({ cachedAt }: { cachedAt: string | null }) {
  const { i18n, t } = useTranslation();

  if (!cachedAt) {
    return null;
  }

  return (
    <Text style={appScreenStyles.note}>
      {t('offline.cachedDataNotice', {
        time: formatCachedAt(cachedAt, i18n.language),
      })}
    </Text>
  );
}

function formatCachedAt(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
