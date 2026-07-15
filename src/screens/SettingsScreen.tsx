import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
  Button,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { AppScreen, appScreenStyles } from '../components/AppScreen';
import { setLanguage } from '../i18n';
import type { AuthenticatedStackParamList } from '../navigation/types';
import { useActiveTeam } from '../teams/ActiveTeamContext';
import {
  colors,
  fonts,
  goalRed,
  iceWhite,
  rinkNavy,
} from '../theme/theme';
import { DirectorOrganizationSettingsSection } from './DirectorSettingsScreen';

type Props = NativeStackScreenProps<AuthenticatedStackParamList, 'Settings'>;

type TeamBranding = {
  id: string;
  name: string;
  primary_color: string | null;
  secondary_color: string | null;
  tertiary_color: string | null;
  logo_url: string | null;
};

const BRANDING_PALETTE = [
  goalRed,
  rinkNavy,
  iceWhite,
  '#1f5f8b',
  '#d6a21f',
  '#2f7d4f',
  '#8b1f2f',
  '#f8faf8',
  '#111827',
  '#6b7280',
  '#f97316',
  '#0f766e',
];

const DEFAULT_PRIMARY_COLOR = goalRed;
const DEFAULT_SECONDARY_COLOR = rinkNavy;
const DEFAULT_TERTIARY_COLOR = iceWhite;
const TEAM_LOGOS_BUCKET = 'team-logos';

export function SettingsScreen(_props: Props) {
  const { i18n, t } = useTranslation();
  const { signOut } = useAuth();
  const { setActiveTeam } = useActiveTeam();
  const nextLanguage = i18n.resolvedLanguage === 'fr' ? 'en' : 'fr';

  async function handleSignOut() {
    try {
      setActiveTeam(null);
      await signOut();
    } catch (error) {
      console.error('Unable to sign out:', error);
    }
  }

  return (
    <AppScreen
      description={t('settings.description')}
      title={t('settings.title')}
    >
      <DirectorOrganizationSettingsSection />
      <TeamBrandingSection />
      <View style={appScreenStyles.card}>
        <Text style={appScreenStyles.cardTitle}>
          {t('settings.languageTitle')}
        </Text>
        <Text style={appScreenStyles.cardDescription}>
          {t('settings.languageDescription')}
        </Text>
        <Button
          color={goalRed}
          title={t('settings.languageToggle', {
            language: nextLanguage.toUpperCase(),
          })}
          onPress={() => void setLanguage(nextLanguage)}
        />
      </View>
      <Button
        color={goalRed}
        title={t('common.signOut')}
        onPress={() => void handleSignOut()}
      />
    </AppScreen>
  );
}

function TeamBrandingSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { activeTeam, setActiveTeam } = useActiveTeam();
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR);
  const [tertiaryColor, setTertiaryColor] = useState(DEFAULT_TERTIARY_COLOR);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const brandingQuery = useQuery({
    queryKey: ['team-branding', activeTeam?.id],
    queryFn: async () => {
      if (!activeTeam) {
        throw new Error(t('settings.teamBrandingNoTeamTitle'));
      }

      const { data, error: loadError } = await supabase
        .from('teams')
        .select(
          'id, name, primary_color, secondary_color, tertiary_color, logo_url',
        )
        .eq('id', activeTeam.id)
        .single();

      if (loadError) {
        throw loadError;
      }

      return data as TeamBranding;
    },
    enabled: Boolean(activeTeam),
  });

  useEffect(() => {
    const branding = brandingQuery.data;

    if (!branding) {
      return;
    }

    setPrimaryColor(branding.primary_color ?? DEFAULT_PRIMARY_COLOR);
    setSecondaryColor(branding.secondary_color ?? DEFAULT_SECONDARY_COLOR);
    setTertiaryColor(branding.tertiary_color ?? DEFAULT_TERTIARY_COLOR);
    setLogoUrl(branding.logo_url);
  }, [brandingQuery.data]);

  async function refreshTeamCaches() {
    await queryClient.invalidateQueries({
      queryKey: ['team-branding', activeTeam?.id],
    });
    await queryClient.invalidateQueries({ queryKey: ['director-teams'] });
    await queryClient.invalidateQueries({ queryKey: ['coach-teams'] });
  }

  async function updateTeamBranding(payload: Partial<TeamBranding>) {
    if (!activeTeam) {
      return false;
    }

    const { error: updateError } = await supabase
      .from('teams')
      .update(payload)
      .eq('id', activeTeam.id);

    if (updateError) {
      throw updateError;
    }

    setActiveTeam({
      ...activeTeam,
      primary_color: payload.primary_color ?? activeTeam.primary_color,
      secondary_color: payload.secondary_color ?? activeTeam.secondary_color,
      tertiary_color: payload.tertiary_color ?? activeTeam.tertiary_color,
      logo_url: payload.logo_url ?? activeTeam.logo_url,
    });
    await refreshTeamCaches();
    return true;
  }

  async function saveColors() {
    if (!activeTeam) {
      return;
    }

    setError('');
    setSuccessMessage('');
    setIsSaving(true);

    try {
      await updateTeamBranding({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        tertiary_color: tertiaryColor,
      });
      setSuccessMessage(t('settings.teamBrandingSaveSuccess'));
    } catch (saveError) {
      console.error('Unable to save team branding:', saveError);
      setError(t('settings.teamBrandingSaveError'));
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadLogo() {
    if (!activeTeam) {
      return;
    }

    setError('');
    setSuccessMessage('');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(t('settings.teamBrandingLogoPermissionError'));
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (pickerResult.canceled) {
      return;
    }

    const asset = pickerResult.assets[0];

    if (!asset) {
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch(asset.uri);
      const fileBody = await response.arrayBuffer();
      const fileExtension = getImageExtension(
        asset.fileName ?? asset.uri,
        asset.mimeType,
      );
      const contentType = asset.mimeType ?? `image/${fileExtension}`;
      const storagePath = `${activeTeam.id}/logo-${Date.now()}.${fileExtension}`;
      const { error: uploadError } = await supabase.storage
        .from(TEAM_LOGOS_BUCKET)
        .upload(storagePath, fileBody, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from(TEAM_LOGOS_BUCKET)
        .getPublicUrl(storagePath);
      const publicUrl = data.publicUrl;

      await updateTeamBranding({ logo_url: publicUrl });
      setLogoUrl(publicUrl);
      setSuccessMessage(t('settings.teamBrandingLogoSuccess'));
    } catch (uploadError) {
      console.error('Unable to upload team logo:', uploadError);
      setError(t('settings.teamBrandingLogoError'));
    } finally {
      setIsUploading(false);
    }
  }

  if (!activeTeam) {
    return (
      <View style={appScreenStyles.card}>
        <Text style={appScreenStyles.cardTitle}>
          {t('settings.teamBrandingNoTeamTitle')}
        </Text>
        <Text style={appScreenStyles.cardDescription}>
          {t('settings.teamBrandingNoTeamDescription')}
        </Text>
      </View>
    );
  }

  const teamName = brandingQuery.data?.name ?? activeTeam.name;

  return (
    <View style={appScreenStyles.card}>
      <Text style={appScreenStyles.cardTitle}>
        {t('settings.teamBrandingTitle')}
      </Text>
      <Text style={appScreenStyles.cardDescription}>
        {t('settings.teamBrandingDescription', { teamName })}
      </Text>
      {brandingQuery.isLoading ? (
        <Text style={appScreenStyles.note}>{t('common.loading')}</Text>
      ) : null}
      {brandingQuery.error ? (
        <Text style={appScreenStyles.error}>
          {t('settings.teamBrandingLoadError')}
        </Text>
      ) : null}
      <View style={styles.logoRow}>
        <View style={styles.logoFrame}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoImage} />
          ) : (
            <Text style={styles.logoPlaceholder}>
              {getTeamInitials(teamName)}
            </Text>
          )}
        </View>
        <View style={styles.logoActions}>
          <Text style={styles.sectionLabel}>
            {t('settings.teamBrandingLogoLabel')}
          </Text>
          <Button
            color={goalRed}
            disabled={isUploading || brandingQuery.isLoading}
            title={
              isUploading
                ? t('settings.teamBrandingUploading')
                : t('settings.teamBrandingUploadButton')
            }
            onPress={() => void uploadLogo()}
          />
        </View>
      </View>
      <View style={styles.previewCard}>
        <Text style={styles.sectionLabel}>
          {t('settings.teamBrandingPreviewLabel')}
        </Text>
        <View style={styles.previewShapes}>
          <View
            style={[
              styles.previewCircle,
              { backgroundColor: primaryColor },
            ]}
          />
          <View
            style={[
              styles.previewBar,
              { backgroundColor: secondaryColor },
            ]}
          />
          <View
            style={[
              styles.previewPill,
              { backgroundColor: tertiaryColor },
            ]}
          />
        </View>
      </View>
      <ColorPicker
        label={t('settings.teamBrandingPrimaryColor')}
        selectedColor={primaryColor}
        setSelectedColor={setPrimaryColor}
      />
      <ColorPicker
        label={t('settings.teamBrandingSecondaryColor')}
        selectedColor={secondaryColor}
        setSelectedColor={setSecondaryColor}
      />
      <ColorPicker
        label={t('settings.teamBrandingTertiaryColor')}
        selectedColor={tertiaryColor}
        setSelectedColor={setTertiaryColor}
      />
      {error ? <Text style={appScreenStyles.error}>{error}</Text> : null}
      {successMessage ? (
        <Text style={styles.success}>{successMessage}</Text>
      ) : null}
      <Button
        color={goalRed}
        disabled={isSaving || isUploading || brandingQuery.isLoading}
        title={
          isSaving
            ? t('settings.teamBrandingSaving')
            : t('settings.teamBrandingSaveButton')
        }
        onPress={() => void saveColors()}
      />
    </View>
  );
}

function ColorPicker({
  label,
  selectedColor,
  setSelectedColor,
}: {
  label: string;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.colorPicker}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.swatchGrid}>
        {BRANDING_PALETTE.map((color) => {
          const isSelected = color === selectedColor;

          return (
            <Pressable
              accessibilityLabel={t('settings.teamBrandingColorOptionLabel', {
                color,
              })}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={color}
              onPress={() => setSelectedColor(color)}
              style={[
                styles.swatchButton,
                isSelected && styles.selectedSwatch,
              ]}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  color === '#f8faf8' && styles.lightSwatch,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function getImageExtension(fileNameOrUri: string, mimeType?: string | null) {
  if (mimeType?.includes('png')) {
    return 'png';
  }

  if (mimeType?.includes('webp')) {
    return 'webp';
  }

  const extension = fileNameOrUri.split('.').pop()?.toLowerCase();

  if (extension === 'png' || extension === 'webp' || extension === 'jpg') {
    return extension;
  }

  return 'jpeg';
}

function getTeamInitials(teamName: string) {
  const initials = teamName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

  return initials || 'CL';
}

const styles = StyleSheet.create({
  colorPicker: {
    gap: 8,
  },
  lightSwatch: {
    borderColor: colors.border,
    borderWidth: 1,
  },
  logoActions: {
    flex: 1,
    gap: 8,
  },
  logoFrame: {
    alignItems: 'center',
    backgroundColor: colors.cardPressed,
    borderColor: goalRed,
    borderRadius: 42,
    borderWidth: 2,
    height: 84,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 84,
  },
  logoImage: {
    height: '100%',
    width: '100%',
  },
  logoPlaceholder: {
    color: goalRed,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '900',
  },
  logoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  previewBar: {
    borderRadius: 12,
    flex: 1,
    height: 24,
  },
  previewCard: {
    backgroundColor: colors.cardPressed,
    borderRadius: 12,
    gap: 10,
    padding: 12,
  },
  previewCircle: {
    borderRadius: 28,
    height: 56,
    width: 56,
  },
  previewPill: {
    borderRadius: 999,
    height: 24,
    width: 96,
  },
  previewShapes: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  selectedSwatch: {
    borderColor: goalRed,
    borderWidth: 2,
  },
  success: {
    color: colors.success,
    lineHeight: 20,
  },
  swatch: {
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  swatchButton: {
    borderColor: 'transparent',
    borderRadius: 22,
    borderWidth: 2,
    padding: 4,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
