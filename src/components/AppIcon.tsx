import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { colors } from '../theme/theme';

export type AppIconName = ComponentProps<typeof Ionicons>['name'];

export function AppIcon({
  color = colors.textPrimary,
  name,
  size = 22,
}: {
  color?: string;
  name: AppIconName;
  size?: number;
}) {
  return <Ionicons color={color} name={name} size={size} />;
}
