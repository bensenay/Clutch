import { useState, type PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { brushed, insetShadow, radii } from '../theme/theme';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = PropsWithChildren<
  PressableProps & {
    // Paints a brushed gradient behind the content; flips to the pressed
    // gradient with an inset top line while held.
    surface?: boolean;
    style?: StyleProp<ViewStyle>;
  }
>;

export function AnimatedPressable({
  children,
  onPressIn,
  onPressOut,
  style,
  surface,
  ...props
}: AnimatedPressableProps) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const radius =
    (StyleSheet.flatten(style as StyleProp<ViewStyle>) as ViewStyle | undefined)
      ?.borderRadius ?? radii.card;

  return (
    <AnimatedPressableBase
      {...props}
      onPressIn={(event) => {
        setPressed(true);
        scale.value = withTiming(0.99, { duration: 90 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        scale.value = withTiming(1, { duration: 130 });
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {surface ? (
        <LinearGradient
          {...(pressed ? brushed.steelPressed : brushed.card)}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}
      {pressed ? (
        <View
          pointerEvents="none"
          style={{
            backgroundColor: insetShadow,
            height: 2,
            left: 1,
            position: 'absolute',
            right: 1,
            top: 0,
          }}
        />
      ) : null}
      {children}
    </AnimatedPressableBase>
  );
}
