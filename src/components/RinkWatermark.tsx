import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image,
  Line,
  Rect,
  type CircleProps,
  type LineProps,
  type RectProps,
} from 'react-native-svg';
import { goalRed, iceWhite } from '../theme/theme';

type RinkWatermarkProps = {
  logoUrl?: string | null;
};

export const RINK_VIEWBOX_WIDTH = 1000;
export const RINK_VIEWBOX_HEIGHT = 1800;
const RINK_BLUE = '#2F68AD';

type RinkLineArtworkProps = {
  drawProgress?: SharedValue<number>;
  includeBoundary?: boolean;
  opacity?: number;
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function RinkLineArtwork({
  drawProgress,
  includeBoundary = true,
  opacity = 0.22,
}: RinkLineArtworkProps) {
  if (!drawProgress) {
    return (
      <StaticRinkLineArtwork
        includeBoundary={includeBoundary}
        opacity={opacity}
      />
    );
  }

  return (
    <G opacity={opacity}>
      {includeBoundary ? (
        <DrawnRect
          drawProgress={drawProgress}
          height={1740}
          length={5034}
          rx={190}
          stroke={iceWhite}
          width={940}
          x={30}
          y={30}
        />
      ) : null}
      <DrawnLine drawProgress={drawProgress} length={904} stroke={RINK_BLUE} x1={48} x2={952} y1={600} y2={600} />
      <DrawnLine drawProgress={drawProgress} length={904} stroke={RINK_BLUE} x1={48} x2={952} y1={1200} y2={1200} />
      <DrawnLine drawProgress={drawProgress} length={904} stroke={goalRed} strokeWidth={12} x1={48} x2={952} y1={900} y2={900} />
      <DrawnCircle cx={500} cy={900} drawProgress={drawProgress} length={974} r={155} stroke={goalRed} />
      <DrawnCircle cx={500} cy={900} drawProgress={drawProgress} length={76} r={12} stroke={goalRed} strokeWidth={24} />
      <DrawnCircle cx={270} cy={350} drawProgress={drawProgress} length={742} r={118} stroke={goalRed} strokeWidth={12} />
      <DrawnCircle cx={730} cy={350} drawProgress={drawProgress} length={742} r={118} stroke={goalRed} strokeWidth={12} />
      <DrawnCircle cx={270} cy={1450} drawProgress={drawProgress} length={742} r={118} stroke={goalRed} strokeWidth={12} />
      <DrawnCircle cx={730} cy={1450} drawProgress={drawProgress} length={742} r={118} stroke={goalRed} strokeWidth={12} />
    </G>
  );
}

function StaticRinkLineArtwork({
  includeBoundary,
  opacity,
}: {
  includeBoundary: boolean;
  opacity: number;
}) {
  const common = {
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
  };

  return (
    <>
      {includeBoundary ? (
        <Rect fill={iceWhite} fillOpacity={0.025} height={1740} rx={190} width={940} x={30} y={30} />
      ) : null}
      <G opacity={opacity}>
        {includeBoundary ? (
          <Rect {...common} height={1740} rx={190} stroke={iceWhite} strokeWidth={18} width={940} x={30} y={30} />
        ) : null}
        <Line {...common} stroke={RINK_BLUE} strokeWidth={16} x1={48} x2={952} y1={600} y2={600} />
        <Line {...common} stroke={RINK_BLUE} strokeWidth={16} x1={48} x2={952} y1={1200} y2={1200} />
        <Line {...common} stroke={goalRed} strokeWidth={12} x1={48} x2={952} y1={900} y2={900} />
        <Circle {...common} cx={500} cy={900} r={155} stroke={goalRed} strokeWidth={14} />
        <Circle {...common} cx={500} cy={900} r={12} stroke={goalRed} strokeWidth={24} />
        <Circle {...common} cx={270} cy={350} r={118} stroke={goalRed} strokeWidth={12} />
        <Circle {...common} cx={730} cy={350} r={118} stroke={goalRed} strokeWidth={12} />
        <Circle {...common} cx={270} cy={1450} r={118} stroke={goalRed} strokeWidth={12} />
        <Circle {...common} cx={730} cy={1450} r={118} stroke={goalRed} strokeWidth={12} />
      </G>
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
        height="96%"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${RINK_VIEWBOX_WIDTH} ${RINK_VIEWBOX_HEIGHT}`}
        width="96%"
      >
        <Defs>
          <ClipPath id="centerIceLogoClip">
            <Circle cx={500} cy={900} r={138} />
          </ClipPath>
        </Defs>
        <RinkLineArtwork includeBoundary={false} opacity={0.1} />
        {logoUrl ? (
          <Image
            clipPath="url(#centerIceLogoClip)"
            height={276}
            href={{ uri: logoUrl }}
            opacity={0.1}
            preserveAspectRatio="xMidYMid meet"
            width={276}
            x={362}
            y={762}
          />
        ) : null}
      </Svg>
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
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
