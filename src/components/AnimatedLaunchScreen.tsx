import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '../../lib/supabase';
import {
  RinkLineArtwork,
  RINK_VIEWBOX_HEIGHT,
  RINK_VIEWBOX_WIDTH,
} from './RinkWatermark';
import { fonts, rinkNavy } from '../theme/theme';

const DARK_HOLD_MS = 180;
const RINK_DRAW_MS = 360;
const LOGO_START_MS = 500;
const LOGO_SPRING_MS = 360;
const FADE_START_MS = 1120;
const FADE_DURATION_MS = 180;

export const LAUNCH_SEQUENCE_DURATION_MS = FADE_START_MS + FADE_DURATION_MS;

type AnimatedLaunchScreenProps = {
  onFinished: () => void;
  useBrandFont: boolean;
};

type MembershipLogoRow = {
  teams: { logo_url: string | null } | Array<{ logo_url: string | null }> | null;
};

export function AnimatedLaunchScreen({
  onFinished,
  useBrandFont,
}: AnimatedLaunchScreenProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [displayLogoUrl, setDisplayLogoUrl] = useState<string | null>(null);
  const teamLogoUrl = useRef<string | null>(null);
  const nativeSplashHidden = useRef(false);
  const rinkDrawProgress = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.72);
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    let cancelled = false;

    async function prepareTeamLogo() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session || cancelled) return;

      const { data: membership } = await supabase
        .from('team_memberships')
        .select('teams ( logo_url )')
        .eq('user_id', session.user.id)
        .order('created_at')
        .limit(1)
        .maybeSingle();

      if (!membership || cancelled) return;

      const relation = (membership as MembershipLogoRow).teams;
      const team = Array.isArray(relation) ? relation[0] : relation;
      const logoUrl = team?.logo_url;

      if (!logoUrl) return;

      try {
        const loaded = await Image.prefetch(logoUrl);
        if (loaded && !cancelled) teamLogoUrl.current = logoUrl;
      } catch {
        // The local Clutch wordmark remains the deterministic fallback.
      }
    }

    void prepareTeamLogo();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    const logoLockTimer = setTimeout(() => {
      setDisplayLogoUrl(teamLogoUrl.current);
    }, LOGO_START_MS - 20);

    rinkDrawProgress.value = withDelay(
      DARK_HOLD_MS,
      withTiming(1, {
        duration: RINK_DRAW_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
    logoOpacity.value = withDelay(
      LOGO_START_MS,
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
    );
    logoScale.value = withDelay(
      LOGO_START_MS,
      withSpring(1, {
        dampingRatio: 0.72,
        duration: LOGO_SPRING_MS,
      }),
    );
    overlayOpacity.value = withDelay(
      FADE_START_MS,
      withTiming(
        0,
        { duration: FADE_DURATION_MS, easing: Easing.inOut(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(onFinished)();
        },
      ),
    );

    return () => clearTimeout(logoLockTimer);
  }, [
    hasStarted,
    logoOpacity,
    logoScale,
    onFinished,
    overlayOpacity,
    rinkDrawProgress,
  ]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const beginSequence = useCallback(() => {
    if (nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;
    setHasStarted(true);
    void SplashScreen.hideAsync();
  }, []);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={beginSequence}
      style={[styles.overlay, overlayStyle]}
    >
      <Svg
        height="92%"
        preserveAspectRatio="xMidYMid meet"
        style={styles.rink}
        viewBox={`0 0 ${RINK_VIEWBOX_WIDTH} ${RINK_VIEWBOX_HEIGHT}`}
        width="92%"
      >
        <RinkLineArtwork drawProgress={rinkDrawProgress} opacity={0.34} />
      </Svg>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        {displayLogoUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={{ uri: displayLogoUrl }}
            style={styles.teamLogo}
          />
        ) : (
          <Text
            style={[
              styles.wordmark,
              useBrandFont ? styles.wordmarkBrandFont : null,
            ]}
          >
            CLUTCH
          </Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: 'center',
    height: 180,
    justifyContent: 'center',
    left: '20%',
    position: 'absolute',
    top: '40%',
    width: '60%',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: rinkNavy,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  rink: {
    position: 'absolute',
  },
  teamLogo: {
    height: '100%',
    width: '100%',
  },
  wordmark: {
    color: '#EAF2F7',
    fontSize: 62,
    fontWeight: '900',
    letterSpacing: 9,
  },
  wordmarkBrandFont: {
    fontFamily: fonts.display,
  },
});
