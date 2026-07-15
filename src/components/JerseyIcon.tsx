import Svg, {
  Defs,
  G,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { fonts, goalRed, iceWhite, rinkNavy, slateGrey } from '../theme/theme';

type JerseyIconProps = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  tertiaryColor?: string | null;
  label?: string | number | null;
  size?: number;
  isEmpty?: boolean;
};

const DEFAULT_PRIMARY_COLOR = goalRed;
const DEFAULT_SECONDARY_COLOR = rinkNavy;
const DEFAULT_TERTIARY_COLOR = iceWhite;
const EMPTY_FILL = iceWhite;
const EMPTY_STROKE = '#8f9a94';
const EMPTY_TEXT = slateGrey;

export function JerseyIcon({
  primaryColor = DEFAULT_PRIMARY_COLOR,
  secondaryColor = DEFAULT_SECONDARY_COLOR,
  tertiaryColor = DEFAULT_TERTIARY_COLOR,
  label,
  size = 56,
  isEmpty = false,
}: JerseyIconProps) {
  const primary = primaryColor || DEFAULT_PRIMARY_COLOR;
  const secondary = secondaryColor || DEFAULT_SECONDARY_COLOR;
  const tertiary = tertiaryColor || DEFAULT_TERTIARY_COLOR;
  const displayLabel = String(label ?? '');
  const labelLength = displayLabel.length;
  const fontSize = labelLength >= 3 ? 17 : labelLength === 2 ? 19 : 22;
  const fillColor = isEmpty ? EMPTY_FILL : primary;
  const strokeColor = isEmpty ? EMPTY_STROKE : secondary;
  const accentColor = isEmpty ? EMPTY_STROKE : tertiary;
  const stripeColor = isEmpty ? EMPTY_STROKE : secondary;
  const textColor = isEmpty ? EMPTY_TEXT : getReadableTextColor(primary);

  return (
    <Svg
      accessibilityRole="image"
      height={size}
      viewBox="0 0 100 100"
      width={size}
    >
      <Defs />
      <G>
        <Path
          d="M31 15 L42 9 L50 24 L58 9 L69 15 L84 29 L87 80 L64 80 L67 52 L68 84 L32 84 L33 52 L36 80 L13 80 L16 29 Z"
          fill={fillColor}
          stroke={strokeColor}
          strokeDasharray={isEmpty ? '5 4' : undefined}
          strokeLinejoin="round"
          strokeWidth={isEmpty ? 3 : 2}
        />
        <Path
          d="M42 9 L50 24 L58 9"
          fill="none"
          stroke={accentColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={isEmpty ? 2.5 : 4}
        />
        <Path
          d="M31 15 C34 27 36 39 33 52"
          fill="none"
          opacity={isEmpty ? 0.45 : 0.38}
          stroke={accentColor}
          strokeLinecap="round"
          strokeWidth={2}
        />
        <Path
          d="M69 15 C66 27 64 39 67 52"
          fill="none"
          opacity={isEmpty ? 0.45 : 0.38}
          stroke={accentColor}
          strokeLinecap="round"
          strokeWidth={2}
        />
        <Path
          d="M14 64 L34 65"
          fill="none"
          opacity={isEmpty ? 0.45 : 1}
          stroke={stripeColor}
          strokeLinecap="round"
          strokeWidth={isEmpty ? 2 : 5}
        />
        <Path
          d="M66 65 L86 64"
          fill="none"
          opacity={isEmpty ? 0.45 : 1}
          stroke={stripeColor}
          strokeLinecap="round"
          strokeWidth={isEmpty ? 2 : 5}
        />
        <Rect
          fill={stripeColor}
          height={isEmpty ? 2 : 6}
          opacity={isEmpty ? 0.45 : 1}
          rx="2"
          width="34"
          x="33"
          y="75"
        />
        <SvgText
          fill={textColor}
          fontFamily={fonts.display}
          fontSize={fontSize}
          fontWeight="900"
          textAnchor="middle"
          x="50"
          y={labelLength >= 3 ? 58 : 60}
        >
          {displayLabel}
        </SvgText>
      </G>
    </Svg>
  );
}

function getReadableTextColor(backgroundColor: string) {
  const normalized = backgroundColor.replace('#', '');

  if (normalized.length !== 6) {
    return '#ffffff';
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? rinkNavy : '#ffffff';
}
