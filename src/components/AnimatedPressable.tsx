import type { PropsWithChildren } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = PropsWithChildren<
  PressableProps & {
    style?: StyleProp<ViewStyle>;
  }
>;

export function AnimatedPressable({
  children,
  onPressIn,
  onPressOut,
  style,
  ...props
}: AnimatedPressableProps) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressableBase
      {...props}
      onPressIn={(event) => {
        opacity.value = withTiming(0.84, { duration: 110 });
        scale.value = withTiming(0.98, { duration: 110 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        opacity.value = withTiming(1, { duration: 140 });
        scale.value = withTiming(1, { duration: 140 });
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressableBase>
  );
}
