import type { TextStyle, ViewStyle } from 'react-native';

export const rinkNavy = '#161B21';
export const iceWhite = '#E4E8EB';
export const frostSteel = '#7A8C9A';
export const goalRed = '#C23B41';
export const slateGrey = '#8E9AA4';
export const hornAmber = '#D9A24A';

export const colors = {
  border: '#BCC4CA',
  card: iceWhite,
  cardPressed: '#D3D9DD',
  dangerSoft: '#EBD9DA',
  fieldBackground: '#F4F6F7',
  rinkNavy,
  rinkSurface: '#1F262D',
  success: '#2F7656',
  successSoft: '#D8E6DE',
  textOnDark: iceWhite,
  textPrimary: rinkNavy,
  warningSoft: '#EDE3CF',
  iceWhite,
  frostSteel,
  goalRed,
  slateGrey,
  hornAmber,
};

export const spacing = {
  xxs: 2,
  tight: 3,
  xs: 4,
  formGap: 5,
  lineGap: 6,
  fieldGap: 7,
  sm: 8,
  control: 10,
  compact: 11,
  md: 12,
  gutter: 14,
  lg: 16,
  card: 18,
  section: 20,
  header: 22,
  xl: 24,
  page: 28,
  toolbar: 30,
  xxl: 48,
};

// Sharper scale: precise machined corners. `pill` stays fully round only
// for true circles (avatars, icon badges); chips/badges should use `chip`.
export const radii = {
  xs: 1,
  tight: 2,
  xsm: 2,
  sm: 3,
  md: 4,
  card: 5,
  lg: 5,
  xl: 6,
  xxl: 8,
  swatchButton: 10,
  previewCircle: 14,
  round: 16,
  logoLarge: 20,
  chip: 3,
  pill: 999,
};

export const fontSizes = {
  tiny: 11,
  xs: 12,
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
  xl: 18,
  xxl: 19,
  displaySm: 20,
  displayMd: 22,
  displayLg: 24,
  title: 30,
  screenTitle: 32,
};

export const lineHeights = {
  xs: 18,
  sm: 19,
  md: 20,
  lg: 23,
  drillDescription: 21,
};

export const sizes = {
  xxs: 3,
  xs: 5,
  sm: 6,
  md: 8,
  pathChoiceVertical: 9,
  lg: 10,
  xl: 12,
  xxl: 14,
  previewBarHeight: 24,
  swatch: 32,
  iconButton: 34,
  playerChoice: 38,
  touch: 42,
  jersey: 44,
  iconBadge: 48,
  input: 50,
  previewCircle: 56,
  lineupChipMinWidth: 68,
  logo: 64,
  logoLarge: 84,
  multiline: 78,
  gameMultiline: 110,
  lineupChipNameMaxWidth: 74,
  previewBarWidth: 96,
  toolMinHeight: 62,
  toolMinWidth: 74,
  practiceMultiline: 88,
  directorAssistantMultiline: 92,
  canvasTextMaxWidth: 88,
  membershipButtonMinWidth: 112,
  assistantDateFieldMinWidth: 130,
};

export const fonts = {
  display: 'Oswald_700Bold',
};

// Beveled hairline edge replacing drop shadows: 1px border whose top edge
// catches light (lighter) while left/right/bottom stay darker.
export const bevel = {
  light: {
    borderBottomColor: '#BCC4CA',
    borderColor: '#BCC4CA',
    borderLeftColor: '#C8CFD4',
    borderRightColor: '#C8CFD4',
    borderTopColor: '#F8FAFB',
    borderWidth: 1,
  } satisfies ViewStyle,
  dark: {
    borderBottomColor: '#0E1217',
    borderColor: '#2A323A',
    borderLeftColor: '#262E36',
    borderRightColor: '#262E36',
    borderTopColor: '#434E59',
    borderWidth: 1,
  } satisfies ViewStyle,
  accent: {
    borderBottomColor: '#7E2227',
    borderColor: '#8F2A30',
    borderLeftColor: '#8F2A30',
    borderRightColor: '#8F2A30',
    borderTopColor: '#E58A8E',
    borderWidth: 1,
  } satisfies ViewStyle,
};

// Kept for existing call sites: now a hairline bevel, not a blurred shadow.
export const shadows = {
  subtle: bevel.light,
};

type Gradient = {
  colors: readonly [string, string, ...string[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

const topDown = { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };

// Brushed surfaces: same hue top to bottom, ~4% lighter at the top and ~5%
// darker at the bottom, so it reads as light falling on metal, not a color shift.
export const brushed = {
  card: { colors: ['#EBEEF0', '#E4E8EB', '#DBE0E4'], ...topDown } as Gradient,
  dark: { colors: ['#1E242B', '#161B21', '#11151A'], ...topDown } as Gradient,
  steel: { colors: ['#EEF1F3', '#E1E6E9', '#D2D8DC'], ...topDown } as Gradient,
  steelPressed: {
    colors: ['#C9D0D5', '#D6DCE0', '#DEE3E6'],
    ...topDown,
  } as Gradient,
  accent: { colors: ['#CE4B51', '#C23B41', '#A92F35'], ...topDown } as Gradient,
  accentPressed: {
    colors: ['#962A2F', '#A53138', '#B03840'],
    ...topDown,
  } as Gradient,
  wood: {
    colors: ['#A57248', '#865937', '#684128'],
    ...topDown,
  } as Gradient,
  woodPressed: {
    colors: ['#654027', '#74492D', '#815536'],
    ...topDown,
  } as Gradient,
  woodInterior: {
    colors: ['#33251C', '#201A16', '#151311'],
    ...topDown,
  } as Gradient,
};

// Inner shadow line at the top edge of a pressed control.
export const insetShadow = 'rgba(0, 0, 0, 0.28)';

// Selected segment/filter/chip: quiet dark steel plate, not the accent color.
export const selectionStyles = {
  active: {
    backgroundColor: '#2C353D',
    borderBottomColor: '#12161B',
    borderColor: '#1B2127',
    borderTopColor: '#4A5662',
  } satisfies ViewStyle,
  activeText: {
    color: iceWhite,
  } satisfies TextStyle,
};
