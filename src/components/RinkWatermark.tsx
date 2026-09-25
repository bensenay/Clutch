import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Line,
  Rect,
  type CircleProps,
  type LineProps,
  type RectProps,
} from 'react-native-svg';
import { iceWhite } from '../theme/theme';

type RinkWatermarkProps = {
  logoUrl?: string | null;
};

export const RINK_VIEWBOX_WIDTH = 1000;
export const RINK_VIEWBOX_HEIGHT = 1800;

type RinkLineArtworkProps = {
  drawProgress?: SharedValue<number>;
  opacity?: number;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function RinkLineArtwork({
  drawProgress,
  opacity = 0.15,
}: RinkLineArtworkProps) {
  if (!drawProgress) {
    return <StaticRinkLineArtwork opacity={opacity} />;
  }

  return (
    <>
      <DrawnRect
        drawProgress={drawProgress}
        height={1740}
        length={5034}
        opacity={opacity}
        rx={190}
        width={940}
        x={30}
        y={30}
      />
      <DrawnLine drawProgress={drawProgress} length={930} opacity={opacity} x1={35} x2={965} y1={600} y2={600} />
      <DrawnLine drawProgress={drawProgress} length={930} opacity={opacity} x1={35} x2={965} y1={1200} y2={1200} />
      <DrawnLine drawProgress={drawProgress} length={930} opacity={opacity} strokeWidth={12} x1={35} x2={965} y1={900} y2={900} />
      <DrawnCircle cx={500} cy={900} drawProgress={drawProgress} length={974} opacity={opacity} r={155} />
      <DrawnCircle cx={500} cy={900} drawProgress={drawProgress} length={76} opacity={opacity} r={12} strokeWidth={24} />
      <DrawnCircle cx={270} cy={350} drawProgress={drawProgress} length={742} opacity={opacity} r={118} strokeWidth={12} />
      <DrawnCircle cx={730} cy={350} drawProgress={drawProgress} length={742} opacity={opacity} r={118} strokeWidth={12} />
      <DrawnCircle cx={270} cy={1450} drawProgress={drawProgress} length={742} opacity={opacity} r={118} strokeWidth={12} />
      <DrawnCircle cx={730} cy={1450} drawProgress={drawProgress} length={742} opacity={opacity} r={118} strokeWidth={12} />
    </>
  );
}

function StaticRinkLineArtwork({ opacity }: { opacity: number }) {
  const common = {
    fill: 'none' as const,
    opacity,
    stroke: iceWhite,
    strokeLinecap: 'round' as const,
  };

  return (
    <>
      <Rect {...common} height={1740} rx={190} strokeWidth={18} width={940} x={30} y={30} />
      <Line {...common} strokeWidth={16} x1={35} x2={965} y1={600} y2={600} />
      <Line {...common} strokeWidth={16} x1={35} x2={965} y1={1200} y2={1200} />
      <Line {...common} strokeWidth={12} x1={35} x2={965} y1={900} y2={900} />
      <Circle {...common} cx={500} cy={900} r={155} strokeWidth={14} />
      <Circle {...common} cx={500} cy={900} r={12} strokeWidth={24} />
      <Circle {...common} cx={270} cy={350} r={118} strokeWidth={12} />
      <Circle {...common} cx={730} cy={350} r={118} strokeWidth={12} />
      <Circle {...common} cx={270} cy={1450} r={118} strokeWidth={12} />
      <Circle {...common} cx={730} cy={1450} r={118} strokeWidth={12} />
    </>
  );
}

export function RinkWatermark({ logoUrl }: RinkWatermarkProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.container}
    >
      <Svg
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        viewBox={`0 0 ${RINK_VIEWBOX_WIDTH} ${RINK_VIEWBOX_HEIGHT}`}
        width="100%"
      >
        <RinkLineArtwork />
      </Svg>
      {logoUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={{ uri: logoUrl }}
          style={styles.logo}
        />
      ) : null}
    </View>
  );
}

function DrawnLine({
  drawProgress,
  length,
  opacity,
  strokeWidth = 16,
  ...props
}: LineProps & RinkLineArtworkProps & { length: number }) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - (drawProgress?.value ?? 1)),
  }));

  return (
    <AnimatedLine
      animatedProps={animatedProps}
      fill="none"
      opacity={opacity}
      stroke={iceWhite}
      strokeDasharray={`${length} ${length}`}
      strokeLinecap="round"
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}

function DrawnCircle({
  drawProgress,
  length,
  opacity,
  strokeWidth = 14,
  ...props
}: CircleProps & RinkLineArtworkProps & { length: number }) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - (drawProgress?.value ?? 1)),
  }));

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      fill="none"
      opacity={opacity}
      stroke={iceWhite}
      strokeDasharray={`${length} ${length}`}
      strokeLinecap="round"
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}

function DrawnRect({
  drawProgress,
  length,
  opacity,
  ...props
}: RectProps & RinkLineArtworkProps & { length: number }) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - (drawProgress?.value ?? 1)),
  }));

  return (
    <AnimatedRect
      animatedProps={animatedProps}
      fill="none"
      opacity={opacity}
      stroke={iceWhite}
      strokeDasharray={`${length} ${length}`}
      strokeLinecap="round"
      strokeWidth={18}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  logo: {
    height: '18%',
    left: '30%',
    opacity: 0.13,
    position: 'absolute',
    top: '41%',
    width: '40%',
  },
});
