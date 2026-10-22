import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { useBrandReducedMotion } from './StorigamBrand';

const S_PATH =
  'M167.4,-290.2 C220.1,-297.6 269.7,-257.3 269.7,-208.9 C269.7,-167.4 241.8,-136.4 201.5,-119.7 C152.1,-98.6 102.7,-77.5 53.3,-56.4 C104.8,-31 156.2,-5.6 207.7,19.8 C232.5,34.1 249.2,62 251.1,99.2 C251.1,145.7 207.7,189.1 133.3,212.7 C45.5,236.8 -42.4,261 -130.2,285.2 C-146.7,287.7 -155,291.4 -179.8,292.6 C-223.2,292.6 -267.8,260.4 -267.8,210.8 C-269.7,176.7 -251.1,136.4 -198.4,114.7 C-171.9,104.4 -145.5,94 -119,83.7 C-143.4,69.9 -167.8,56 -192.2,42.2 C-226.3,21.7 -255.4,-15.5 -254.2,-52.7 C-251.1,-114.7 -192.2,-164.3 -127.1,-196.5 C-28.9,-227.7 69.2,-259 167.4,-290.2Z';
const CIRCLE_PATH =
  'M117.4,-203.6 C143.1,-188.7 165.7,-169.2 184.1,-146 C200,-126 212.4,-103.7 221.1,-79.7 C233.5,-45.3 237.7,-8.4 233.3,27.9 C228.7,66.8 214.4,103.9 191.8,135.8 C179.9,152.6 165.9,167.7 150.2,180.8 C121.6,204.5 87.8,221.1 51.5,229.3 C-9.6,243 -73.6,231.8 -126.4,198.1 C-136,192 -145.1,185.2 -153.7,177.8 C-174.3,159.9 -191.7,138.7 -205,114.9 C-218.1,91.4 -227.2,65.9 -231.7,39.4 C-234.9,20.4 -235.8,1 -234.3,-18.2 C-232.8,-37.2 -229,-55.9 -223,-74 C-215,-98.4 -202.9,-121.3 -187.4,-141.8 C-161.1,-176.6 -125.5,-203.4 -84.8,-219.2 C-18.5,-244.8 55.9,-239.1 117.4,-203.6Z';
const PLAY_PATH =
  'M-65.1,-75.6 C-65.1,-95.5 -42.2,-112.8 -23.6,-101.7 L105.4,-21.7 C120.3,-9.3 120.3,9.3 105.4,21.7 L-25.4,99.2 C-45.3,110.4 -65.1,96.7 -65.1,78.1Z';

interface Props {
  size?: number;
  color?: string;
  animated?: boolean;
  accessible?: boolean;
}

/** Native-friendly adaptation of the supplied animated S/play SVG. */
export function StorigamAnimatedMark({
  size = 40,
  color = '#0a0a0a',
  animated = true,
  accessible = true,
}: Props) {
  const reduceMotion = useBrandReducedMotion();
  const morph = useRef(new Animated.Value(0)).current;
  const turn = useRef(new Animated.Value(0)).current;
  const playProgress = useRef(new Animated.Value(0)).current;
  const playSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const values = [morph, turn, playProgress, playSpin];
    const reset = () => values.forEach((value) => value.stopAnimation(() => value.setValue(0)));
    if (!animated || reduceMotion) {
      reset();
      return;
    }

    const useNativeDriver = Platform.OS !== 'web';
    const ease = Easing.inOut(Easing.cubic);
    const morphIn = Animated.parallel([
      Animated.timing(morph, { toValue: 1, duration: 810, easing: ease, useNativeDriver }),
      Animated.timing(turn, { toValue: 1, duration: 810, easing: ease, useNativeDriver }),
      Animated.timing(playProgress, { toValue: 1, duration: 810, easing: ease, useNativeDriver }),
    ]);
    const morphOut = Animated.parallel([
      Animated.timing(morph, { toValue: 0, duration: 810, easing: ease, useNativeDriver }),
      Animated.timing(turn, { toValue: 2, duration: 810, easing: ease, useNativeDriver }),
      Animated.timing(playProgress, { toValue: 0, duration: 810, easing: ease, useNativeDriver }),
    ]);
    const cycle = Animated.loop(
      Animated.sequence([
        Animated.delay(250),
        morphIn,
        Animated.delay(850),
        morphOut,
        Animated.delay(680),
        Animated.timing(turn, { toValue: 0, duration: 1, useNativeDriver }),
      ]),
    );
    const spin = Animated.loop(
      Animated.timing(playSpin, {
        toValue: 1,
        duration: 3400,
        easing: Easing.linear,
        useNativeDriver,
      }),
    );
    cycle.start();
    spin.start();
    return () => {
      cycle.stop();
      spin.stop();
      values.forEach((value) => value.stopAnimation());
    };
  }, [animated, morph, playProgress, playSpin, reduceMotion, turn]);

  const sOpacity = morph.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const sRotation = turn.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['0deg', '180deg', '360deg'],
  });
  const playX = playProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (size * 27.8) / 1000],
  });
  const playY = playProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (-size * 22.9) / 1000],
  });
  const playScale = playProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });
  const playRotation = playSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  return (
    <View
      accessible={accessible}
      accessibilityRole="progressbar"
      accessibilityLabel={accessible ? 'Loading Storigam' : undefined}
      accessibilityState={{ busy: true }}
      style={{ width: size, height: size }}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.layer, { opacity: sOpacity, transform: [{ rotate: sRotation }] }]}
      >
        <Svg width={size} height={size} viewBox="0 0 1000 1000">
          <G transform="translate(500 500)">
            <Path
              d={S_PATH}
              fill={color}
              stroke="#ff2a2a"
              strokeWidth={14}
              strokeLinejoin="round"
            />
          </G>
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.layer, { opacity: morph }]}>
        <Svg width={size} height={size} viewBox="0 0 1000 1000">
          <G transform="translate(500 500)">
            <Path
              d={CIRCLE_PATH}
              fill={color}
              stroke="#ff2a2a"
              strokeWidth={14}
              strokeLinejoin="round"
            />
          </G>
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.layer,
          {
            transform: [
              { translateX: playX },
              { translateY: playY },
              { rotate: playRotation },
              { scale: playScale },
            ],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 1000 1000">
          <G transform="translate(480.2 522.9)">
            <Path
              d={PLAY_PATH}
              fill="#fff"
              stroke="#ff2a2a"
              strokeWidth={10}
              strokeLinejoin="round"
            />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
