import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import {
  bevel,
  brushed,
  colors,
  fontSizes,
  fonts,
  goalRed,
  hornAmber,
  iceWhite,
  radii,
  rinkNavy,
  spacing,
} from '../theme/theme';
import { AnimatedPressable } from './AnimatedPressable';
import { AppIcon } from './AppIcon';
import { JerseyIcon } from './JerseyIcon';

export type LockerStallStatus = 'active' | 'injured' | 'suspended';

type LockerStallProps = {
  accessibilityLabel: string;
  detailsLabel: string;
  firstName: string;
  jerseyNumber: number | null;
  lastName: string;
  onPress: () => void;
  positionLabel: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  status: LockerStallStatus;
  statusLabel: string;
  tertiaryColor?: string | null;
  width: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export function LockerStall({
  accessibilityLabel,
  detailsLabel,
  firstName,
  jerseyNumber,
  lastName,
  onPress,
  positionLabel,
  primaryColor,
  secondaryColor,
  status,
  statusLabel,
  tertiaryColor,
  width,
}: LockerStallProps) {
  const isUnavailable = status !== 'active';
  const statusColor = status === 'suspended' ? hornAmber : goalRed;
  const displayNumber = jerseyNumber ?? '--';
  const height = Math.round(clamp(width * 1.55, 165, 340));
  const sideWidth = Math.round(clamp(width * 0.075, 6, 14));
  const nameplateHeight = Math.round(clamp(height * 0.22, 40, 72));
  const shelfHeight = Math.round(clamp(height * 0.035, 6, 11));
  const detailHeight = Math.round(clamp(height * 0.21, 48, 72));
  const openHeight = height - nameplateHeight - shelfHeight - detailHeight;
  const jerseySize = Math.round(clamp(width * 0.6, 50, 128));
  const compact = width < 130;

  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.stall, { height, width }]}
    >
      <LinearGradient
        {...brushed.wood}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <View
        pointerEvents="none"
        style={[styles.leftPanel, { width: sideWidth }]}
      />
      <View
        pointerEvents="none"
        style={[styles.rightPanel, { width: sideWidth }]}
      />

      <View
        style={[
          styles.nameplateSection,
          {
            gap: compact ? spacing.xxs : spacing.sm,
            height: nameplateHeight,
            marginHorizontal: sideWidth,
            paddingHorizontal: compact ? spacing.xs : spacing.sm,
          },
        ]}
      >
        {isUnavailable ? (
          <View style={[styles.statusBar, { backgroundColor: statusColor }]} />
        ) : null}
        <View style={styles.nameplateCopy}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={2}
            style={[
              styles.playerName,
              compact ? styles.playerNameCompact : null,
            ]}
          >
            {firstName} {lastName}
          </Text>
          {isUnavailable ? (
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                numberOfLines={1}
                style={styles.statusText}
              >
                {statusLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <View
          style={[
            styles.numberPlate,
            compact ? styles.numberPlateCompact : null,
          ]}
        >
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={[styles.numberText, compact ? styles.numberTextCompact : null]}
          >
            #{displayNumber}
          </Text>
        </View>
      </View>

      <LinearGradient
        {...brushed.woodPressed}
        pointerEvents="none"
        style={[
          styles.shelf,
          { height: shelfHeight, marginHorizontal: Math.max(sideWidth - 4, 4) },
        ]}
      />

      <LinearGradient
        {...brushed.woodInterior}
        style={[
          styles.openSection,
          { height: openHeight, marginHorizontal: sideWidth },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.hangerRail,
            {
              left: compact ? spacing.sm : spacing.lg,
              right: compact ? spacing.sm : spacing.lg,
            },
          ]}
        />
        <View style={styles.jerseyStand}>
          <JerseyIcon
            label={displayNumber}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            size={jerseySize}
            tertiaryColor={tertiaryColor}
          />
        </View>
      </LinearGradient>

      <LinearGradient
        {...brushed.woodPressed}
        style={[
          styles.detailSection,
          {
            height: detailHeight,
            paddingHorizontal: compact ? spacing.sm : spacing.md,
            paddingVertical: compact ? spacing.xs : spacing.sm,
          },
        ]}
      >
        <View pointerEvents="none" style={styles.ventRows}>
          {[0, 1, 2].map((vent) => (
            <View key={vent} style={styles.vent} />
          ))}
        </View>
        <View style={styles.detailCopy}>
          <View>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}
              style={[
                styles.detailsLabel,
                compact ? styles.detailsLabelCompact : null,
              ]}
            >
              {detailsLabel}
            </Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}
              style={styles.positionLabel}
            >
              {positionLabel}
            </Text>
          </View>
          {!compact ? (
            <AppIcon color={iceWhite} name="chevron-forward" size={18} />
          ) : null}
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  detailCopy: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailSection: {
    borderTopColor: '#B7865D',
    borderTopWidth: 1,
    justifyContent: 'space-between',
  },
  detailsLabel: {
    color: iceWhite,
    fontSize: fontSizes.sm,
    fontWeight: '800',
  },
  detailsLabelCompact: {
    fontSize: fontSizes.tiny,
  },
  hangerRail: {
    backgroundColor: '#7D878E',
    borderBottomColor: '#07090B',
    borderBottomWidth: 1,
    height: 4,
    position: 'absolute',
    top: spacing.md,
  },
  jerseyStand: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  leftPanel: {
    backgroundColor: 'rgba(70, 39, 22, 0.42)',
    borderRightColor: 'rgba(225, 177, 132, 0.34)',
    borderRightWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  nameplateCopy: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 0,
  },
  nameplateSection: {
    alignItems: 'center',
    backgroundColor: rinkNavy,
    borderBottomColor: '#090C0F',
    borderBottomWidth: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  numberPlate: {
    ...bevel.dark,
    alignItems: 'center',
    backgroundColor: colors.rinkSurface,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 44,
    paddingHorizontal: spacing.xs,
  },
  numberPlateCompact: {
    minHeight: 28,
    minWidth: 28,
    paddingHorizontal: spacing.xxs,
  },
  numberText: {
    color: iceWhite,
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    fontWeight: '900',
  },
  numberTextCompact: {
    fontSize: fontSizes.sm,
  },
  openSection: {
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playerName: {
    color: iceWhite,
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    fontWeight: '800',
    lineHeight: 19,
    textTransform: 'uppercase',
  },
  playerNameCompact: {
    fontSize: fontSizes.tiny,
    lineHeight: 13,
  },
  positionLabel: {
    color: '#DFC19F',
    fontSize: fontSizes.tiny,
    fontWeight: '700',
    marginTop: spacing.xxs,
    textTransform: 'uppercase',
  },
  rightPanel: {
    backgroundColor: 'rgba(70, 39, 22, 0.42)',
    borderLeftColor: 'rgba(225, 177, 132, 0.34)',
    borderLeftWidth: 1,
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  shelf: {
    borderBottomColor: '#3E2718',
    borderBottomWidth: 2,
    borderTopColor: '#C08B5E',
    borderTopWidth: 1,
  },
  stall: {
    ...bevel.dark,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  statusBar: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 3,
  },
  statusDot: {
    borderRadius: radii.pill,
    height: 6,
    width: 6,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statusText: {
    color: '#D5DCE1',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  vent: {
    backgroundColor: 'rgba(27, 18, 12, 0.68)',
    borderTopColor: 'rgba(218, 170, 124, 0.2)',
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 3,
  },
  ventRows: {
    gap: spacing.xs,
  },
});
