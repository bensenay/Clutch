import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

export type SupportedLanguage = 'en' | 'fr';

const LANGUAGE_STORAGE_KEY = 'clutch.language';
const supportedLanguages: SupportedLanguage[] = ['en', 'fr'];
let languageSelectionVersion = 0;

function getSupportedLanguage(
  language: string | null | undefined,
): SupportedLanguage {
  const languageCode = language?.split('-')[0].toLowerCase();
  return supportedLanguages.includes(languageCode as SupportedLanguage)
    ? (languageCode as SupportedLanguage)
    : 'en';
}

const deviceLanguage = getSupportedLanguage(getLocales()[0]?.languageCode);

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  lng: deviceLanguage,
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
});

const hydrationVersion = languageSelectionVersion;

void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((persistedLanguage) => {
  if (
    persistedLanguage &&
    hydrationVersion === languageSelectionVersion
  ) {
    void i18n.changeLanguage(getSupportedLanguage(persistedLanguage));
  }
});

export async function setLanguage(language: SupportedLanguage) {
  languageSelectionVersion += 1;
  await Promise.all([
    i18n.changeLanguage(language),
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language),
  ]);
}

export default i18n;
