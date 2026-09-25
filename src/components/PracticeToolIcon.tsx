import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';

export type PracticeToolIconName =
  | 'player'
  | 'skate'
  | 'pass'
  | 'puck'
  | 'cone'
  | 'net'
  | 'text'
  | 'zone';

export function PracticeToolIcon({
  color,
  name,
  size = 28,
}: {
  color: string;
  name: PracticeToolIconName;
  size?: number;
}) {
  const common = {
    fill: 'none' as const,
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.9,
  };

  return (
    <Svg accessibilityElementsHidden height={size} viewBox="0 0 28 28" width={size}>
      {name === 'player' ? (
        <>
          <Circle {...common} cx={14} cy={8} r={3.5} />
          <Path {...common} d="M7.5 23c.6-5.1 3-8 6.5-8s5.9 2.9 6.5 8" />
          <Path {...common} d="M10 18.5h8" />
        </>
      ) : null}
      {name === 'skate' ? (
        <>
          <Path {...common} d="M4 19.5c3.8-7.3 8.5-9.6 15.2-7.2" />
          <Path {...common} d="m16.3 8.5 3.4 3.9-4.8 1.4" />
          <Path {...common} d="M5 23h14.5c2.2 0 3.7-1 4.5-3" />
          <Line {...common} x1={8} x2={8} y1={21} y2={24.5} />
          <Line {...common} x1={18} x2={18} y1={21} y2={24.5} />
        </>
      ) : null}
      {name === 'pass' ? (
        <>
          <Path {...common} d="M4 18c5-7 10-7 17-4" strokeDasharray="3 3" />
          <Path {...common} d="m18 9 4 5-6 1" />
          <Ellipse cx={5} cy={20.5} fill={color} rx={3.2} ry={1.8} />
        </>
      ) : null}
      {name === 'puck' ? (
        <>
          <Ellipse {...common} cx={14} cy={11} rx={8} ry={3.8} />
          <Path {...common} d="M6 11v6c0 2.1 3.6 3.8 8 3.8s8-1.7 8-3.8v-6" />
          <Path {...common} d="M6.3 16.2c1.2 1.7 4.2 2.8 7.7 2.8s6.5-1.1 7.7-2.8" opacity={0.55} />
        </>
      ) : null}
      {name === 'cone' ? (
        <>
          <Path {...common} d="m14 4 6 17H8l6-17Z" />
          <Line {...common} x1={10.2} x2={17.8} y1={15} y2={15} />
          <Rect {...common} height={3} rx={1.5} width={18} x={5} y={21} />
        </>
      ) : null}
      {name === 'net' ? (
        <>
          <Path {...common} d="M5 8h18v14H5z" />
          <Path {...common} d="m5 8 4 4m4-4 10 10M9 8l14 14M5 14l8 8m4-14 6 6M5 18l4 4" opacity={0.52} />
          <Path {...common} d="M3.5 22H24.5" strokeWidth={2.5} />
        </>
      ) : null}
      {name === 'text' ? (
        <>
          <Path {...common} d="M5 6h18M14 6v16M9.5 22h9" strokeWidth={2.4} />
          <Circle cx={5} cy={6} fill={color} r={1.2} />
          <Circle cx={23} cy={6} fill={color} r={1.2} />
        </>
      ) : null}
      {name === 'zone' ? (
        <>
          <Polygon {...common} fill={color} fillOpacity={0.16} points="5,20 8,7 22,5 24,19 14,24" />
          <Path {...common} d="m8 16 9-9M7 21l15-15M13 23l10-10" opacity={0.62} />
        </>
      ) : null}
    </Svg>
  );
}
