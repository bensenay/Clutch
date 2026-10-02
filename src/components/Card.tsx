import type { PropsWithChildren } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brushed, radii } from '../theme/theme';

type CardProps = PropsWithChildren<ViewProps & { style?: StyleProp<ViewStyle> }>;

// A View whose fill is the brushed-steel gradient instead of a flat color.
// The gradient sits behind the children and follows the card's corner radius.
export function Card({ children, style, ...props }: CardProps) {
  const radius = StyleSheet.flatten(style)?.borderRadius ?? radii.card;

  return (
    <View {...props} style={style}>
      <LinearGradient
        {...brushed.card}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {children}
    </View>
  );
}
