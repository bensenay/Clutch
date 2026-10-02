import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brushed } from '../theme/theme';

type SteelBarProps = {
  // Which edge carries the lit hairline: the tab bar catches light on top,
  // the header's lit edge is its (invisible) top, so it gets a bottom shade.
  edge?: 'top' | 'bottom';
};

export function SteelBar({ edge = 'bottom' }: SteelBarProps) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient {...brushed.dark} style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.line,
          edge === 'top'
            ? { backgroundColor: '#434E59', top: 0 }
            : { backgroundColor: '#0A0D10', bottom: 0 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth * 2,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
