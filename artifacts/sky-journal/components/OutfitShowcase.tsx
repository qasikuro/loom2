import { Icon } from '@/components/Icon';
import { SecureImage as Image } from '@/components/SecureImage';
import { useTheme } from '@/context/ThemeContext';
import { useDecorativeMotion } from '@/components/profile/CharacterAuraHeader';
import type {
  OutfitShowcaseStyle,
  OutfitShowcaseTransition,
} from '@/utils/outfitShowcase';
import { useColors as useDesignColors } from '@workspace/storigam-kindness/hooks/use-colors';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { useTranslation } from 'react-i18next';

type ShowcaseChoice = OutfitShowcaseStyle | 'none';

const VIBE_CAMERA_ENERGY: Record<string, number> = {
  dark: 1.18,
  mythical: 0.92,
  dreamy: 0.62,
  romantic: 0.66,
  happy: 1.08,
  ethereal: 0.72,
  cozy: 0.58,
  adventurous: 1.04,
  energetic: 1.34,
  cool: 0.9,
  glitch: 1.28,
  cute: 0.9,
  emotional: 0.68,
  magical: 0.95,
};

const VIBE_CUT_STRENGTH: Record<string, number> = {
  dark: 1,
  mythical: 0.78,
  dreamy: 0.56,
  romantic: 0.62,
  happy: 0.82,
  ethereal: 0.62,
  cozy: 0.5,
  adventurous: 0.8,
  energetic: 1,
  cool: 0.78,
  glitch: 1,
  cute: 0.7,
  emotional: 0.58,
  magical: 0.84,
};

export function OutfitShowcasePicker({
  value,
  transition,
  imageUri,
  title,
  onChange,
  onTransitionChange,
}: {
  value: OutfitShowcaseStyle | null;
  transition: OutfitShowcaseTransition;
  imageUri?: string;
  title?: string;
  onChange: (style: OutfitShowcaseStyle | null) => void;
  onTransitionChange: (transition: OutfitShowcaseTransition) => void;
}) {
  const { isDark } = useTheme();
  const colors = useDesignColors(isDark ? 'dark' : 'light');
  const { t } = useTranslation();
  const choices: ShowcaseChoice[] = ['none', 'dreamy', 'holographic'];
  const transitions: OutfitShowcaseTransition[] = ['fade', 'zoom', 'slide', 'pan', 'parallax'];

  const labels: Record<ShowcaseChoice, { title: string; description: string }> = {
    none: { title: t('outfitJournal.showcaseNone'), description: t('outfitJournal.showcaseNoneDescription') },
    dreamy: { title: t('outfitJournal.showcaseDreamy'), description: t('outfitJournal.showcaseDreamyDescription') },
    holographic: { title: t('outfitJournal.showcaseHolographic'), description: t('outfitJournal.showcaseHolographicDescription') },
  };

  return (
    <View style={pickerStyles.container}>
      <View style={pickerStyles.heading}>
        <Icon name="sparkles" size={17} color={colors.primary} />
        <Text style={[pickerStyles.title, { color: colors.foreground }]}>
          {t('outfitJournal.showcaseStyle')}
        </Text>
      </View>
      <Text style={[pickerStyles.hint, { color: colors.mutedForeground }]}>
        {t('outfitJournal.showcaseStyleHint')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={pickerStyles.choices}
      >
        {choices.map(choice => {
          const selected = choice === 'none' ? value === null : value === choice;
          const accent = choice === 'dreamy'
            ? colors.chart2
            : choice === 'holographic' ? colors.chart4 : colors.primary;
          return (
            <TouchableOpacity
              key={choice}
              style={[
                pickerStyles.choice,
                {
                  backgroundColor: colors.card,
                  borderColor: selected ? accent : colors.border,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
              onPress={() => onChange(choice === 'none' ? null : choice)}
              activeOpacity={0.82}
              accessibilityRole="radio"
              accessibilityLabel={`${labels[choice].title}. ${labels[choice].description}`}
              accessibilityState={{ selected }}
              testID={`outfit-showcase-${choice}`}
            >
              <View style={pickerStyles.preview}>
                <LinearGradient
                  colors={choice === 'holographic'
                    ? [colors.background, colors.chart1, colors.chart4]
                    : choice === 'dreamy'
                      ? [colors.background, colors.chart2, colors.primary]
                      : [colors.background, colors.secondary, colors.muted]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                {imageUri ? (
                  <OutfitShowcaseMotion style={choice === 'none' ? null : choice} transition={transition}>
                    <Image
                      source={{ uri: imageUri }}
                      style={[StyleSheet.absoluteFill, { opacity: choice === 'none' ? 0.9 : 0.92 }]}
                      contentFit="contain"
                    />
                  </OutfitShowcaseMotion>
                ) : (
                  <Icon name="user" size={28} color={`${accent}B0`} />
                )}
                {title ? (
                  <Text
                    pointerEvents="none"
                    numberOfLines={1}
                    style={[
                      pickerStyles.previewTitle,
                      choice === 'dreamy' && pickerStyles.dreamyPreviewTitle,
                      choice === 'holographic' && pickerStyles.holoPreviewTitle,
                      {
                        color: colors.foreground,
                        textShadowColor: choice === 'dreamy'
                          ? colors.chart2
                          : choice === 'holographic' ? colors.chart4 : colors.background,
                      },
                    ]}
                  >
                    {title}
                  </Text>
                ) : null}
                {choice === 'dreamy' ? (
                  <>
                    <View style={[pickerStyles.dreamyGlow, { backgroundColor: `${colors.chart2}50` }]} />
                    <Icon name="sparkles" size={17} color={colors.accent} style={pickerStyles.dreamySparkle} />
                    <View style={[pickerStyles.dreamyOrb, { borderColor: `${colors.accent}A0` }]} />
                  </>
                ) : null}
                {choice === 'holographic' ? (
                  <>
                    <View style={[pickerStyles.holoBorder, { borderColor: `${colors.chart4}C0` }]} />
                    <View style={[pickerStyles.holoSquare, { borderColor: colors.accent }]} />
                    <View style={[pickerStyles.holoDiamond, { borderColor: colors.chart2 }]} />
                  </>
                ) : null}
                {selected ? (
                  <View style={[pickerStyles.check, { backgroundColor: accent }]}>
                    <Icon name="check" size={11} color={colors.primaryForeground} />
                  </View>
                ) : null}
              </View>
              <Text style={[pickerStyles.choiceTitle, { color: colors.foreground }]} numberOfLines={1}>
                {labels[choice].title}
              </Text>
              <Text style={[pickerStyles.choiceDescription, { color: colors.mutedForeground }]} numberOfLines={2}>
                {labels[choice].description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {value ? (
        <View style={pickerStyles.transitionSection}>
          <Text style={[pickerStyles.transitionHeading, { color: colors.foreground }]}>
            {t('outfitJournal.showcaseTransition')}
          </Text>
          <View style={pickerStyles.transitionChoices} accessibilityRole="radiogroup">
            {transitions.map(option => {
              const selected = option === transition;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    pickerStyles.transitionChoice,
                    {
                      backgroundColor: selected ? `${colors.primary}18` : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => onTransitionChange(option)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityLabel={t(`outfitJournal.showcaseTransition${option.charAt(0).toUpperCase()}${option.slice(1)}`)}
                  accessibilityState={{ selected }}
                  testID={`outfit-showcase-transition-${option}`}
                >
                  <Text style={[
                    pickerStyles.transitionChoiceText,
                    { color: selected ? colors.primary : colors.mutedForeground },
                  ]}>
                    {t(`outfitJournal.showcaseTransition${option.charAt(0).toUpperCase()}${option.slice(1)}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function OutfitShowcaseMotion({
  style,
  transition = 'fade',
  cinematicCamera = false,
  vibe,
  children,
}: {
  style: OutfitShowcaseStyle | null;
  transition?: OutfitShowcaseTransition;
  cinematicCamera?: boolean;
  vibe?: string | null;
  children: React.ReactNode;
}) {
  const { isDark } = useTheme();
  const colors = useDesignColors(isDark ? 'dark' : 'light');
  const { animate } = useDecorativeMotion();
  const cycle = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(1)).current;
  const cameraBeat = useRef(new Animated.Value(0)).current;
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const normalizedVibe = vibe?.toLowerCase() ?? '';
  const hasEditorialCuts = cinematicCamera && normalizedVibe.length > 0;
  const cameraEnergy = VIBE_CAMERA_ENERGY[normalizedVibe] ?? 0.9;
  const cutStrength = VIBE_CUT_STRENGTH[normalizedVibe] ?? 0.72;
  const vibeAccent = normalizedVibe === 'happy' || normalizedVibe === 'cozy'
    ? colors.chart3
    : normalizedVibe === 'romantic' || normalizedVibe === 'cute'
      ? colors.chart2
      : normalizedVibe === 'ethereal' || normalizedVibe === 'magical' || normalizedVibe === 'mythical'
        ? colors.chart1
        : normalizedVibe === 'adventurous' || normalizedVibe === 'cool'
          ? colors.chart5
          : normalizedVibe === 'dark' || normalizedVibe === 'glitch'
            ? colors.chart4
            : colors.chart1;
  const tintEnergy = ['energetic', 'glitch', 'dark'].includes(normalizedVibe)
    ? 1
    : ['dreamy', 'romantic', 'cozy', 'emotional'].includes(normalizedVibe)
      ? 0.48
      : 0.7;

  useEffect(() => {
    cycle.stopAnimation();
    cycle.setValue(0);
    if (!style || !animate) return;

    const duration = style === 'dreamy' ? 3600 : 3200;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(cycle, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(cycle, {
        toValue: 0,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]));
    loop.start();
    return () => {
      loop.stop();
      cycle.stopAnimation();
      cycle.setValue(0);
    };
  }, [animate, cycle, style, transition]);

  useEffect(() => {
    entrance.stopAnimation();
    entrance.setValue(animate && style ? 0 : 1);
    if (!animate || !style) return;
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
      entrance.stopAnimation();
      entrance.setValue(1);
    };
  }, [animate, entrance, style, transition]);

  useEffect(() => {
    cameraBeat.stopAnimation();
    cameraBeat.setValue(0);
    if (!cinematicCamera || !animate) return;

    const move = (toValue: number, duration: number, easing = Easing.inOut(Easing.cubic)) =>
      Animated.timing(cameraBeat, {
        toValue,
        duration,
        easing,
        useNativeDriver: true,
      });
    const sequence = Animated.loop(Animated.sequence([
      move(1, 900),
      move(2, 180, Easing.out(Easing.cubic)),
      move(3, 260, Easing.out(Easing.cubic)),
      move(4, 650),
      move(5, 1000),
      move(6, 150, Easing.out(Easing.cubic)),
      move(7, 300, Easing.out(Easing.cubic)),
      move(8, 1100),
      move(9, 800),
    ]));
    sequence.start();
    return () => {
      sequence.stop();
      cameraBeat.stopAnimation();
      cameraBeat.setValue(0);
    };
  }, [animate, cameraBeat, cinematicCamera]);

  if (!style && !cinematicCamera) return <>{children}</>;

  const floatY = cycle.interpolate({
    inputRange: [0, 1],
    outputRange: [0, style === 'dreamy' ? -5 : -2],
  });
  const glowOpacity = cycle.interpolate({
    inputRange: [0, 1],
    outputRange: style === 'dreamy' ? [0.18, 0.44] : [0.22, 0.54],
  });
  const imageTintOpacity = cycle.interpolate({
    inputRange: [0, 1],
    outputRange: style === 'dreamy' ? [0.04, 0.11] : [0.07, 0.16],
  });
  const turn = cycle.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] });
  const palette: [string, string, string] = style === 'dreamy'
    ? [colors.background, colors.chart2, colors.accent]
    : [colors.background, colors.chart1, colors.chart4];
  const alternatePalette: [string, string, string] = style === 'dreamy'
    ? [colors.background, colors.accent, colors.primary]
    : [colors.background, colors.chart4, colors.chart2];
  const cameraScaleRange: [number, number] = transition === 'zoom'
    ? [1.015, 1.075]
    : transition === 'slide'
      ? [1.03, 1.05]
      : transition === 'pan'
        ? [1.03, 1.05]
        : transition === 'parallax'
          ? [1.04, 1.07]
          : [1.005, 1.025];
  const cameraXRange: [number, number] = transition === 'slide'
    ? [-9, 9]
    : transition === 'pan'
      ? [-6, 6]
      : transition === 'parallax' ? [-11, 11] : [0, 0];
  const cameraYRange: [number, number] = transition === 'pan'
    ? [7, -7]
    : transition === 'parallax' ? [-4, 4] : [0, 0];
  const cameraScale = animate
    ? cinematicCamera
      ? cameraBeat.interpolate({
        inputRange: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        outputRange: [1, 1 + 0.045 * cameraEnergy, 1 + 0.11 * cameraEnergy, 1 + 0.075 * cameraEnergy, 1 + 0.05 * cameraEnergy, 1 + 0.035 * cameraEnergy, 1 + 0.105 * cameraEnergy, 1 + 0.06 * cameraEnergy, 1 + 0.04 * cameraEnergy, 1],
      })
      : cycle.interpolate({ inputRange: [0, 1], outputRange: cameraScaleRange })
    : 1;
  const cameraX = animate
    ? cinematicCamera
      ? cameraBeat.interpolate({
        inputRange: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        outputRange: [0, -5 * cameraEnergy, -2 * cameraEnergy, 0, 2 * cameraEnergy, 8 * cameraEnergy, 11 * cameraEnergy, 6 * cameraEnergy, -8 * cameraEnergy, 0],
      })
      : cycle.interpolate({ inputRange: [0, 1], outputRange: cameraXRange })
    : 0;
  const cameraY = animate
    ? cinematicCamera
      ? cameraBeat.interpolate({
        inputRange: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        outputRange: [0, -8 * cameraEnergy, -14 * cameraEnergy, -8 * cameraEnergy, -5 * cameraEnergy, 8 * cameraEnergy, 2 * cameraEnergy, -1 * cameraEnergy, -4 * cameraEnergy, 0],
      })
      : cycle.interpolate({ inputRange: [0, 1], outputRange: cameraYRange })
    : 0;
  const cameraRotation = animate && cinematicCamera
    ? cameraBeat.interpolate({
      inputRange: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      outputRange: ['0deg', `${-0.15 * cameraEnergy}deg`, `${0.25 * cameraEnergy}deg`, `${0.1 * cameraEnergy}deg`, '0deg', `${-0.2 * cameraEnergy}deg`, `${0.15 * cameraEnergy}deg`, '0deg', `${-0.12 * cameraEnergy}deg`, '0deg'],
    })
    : '0deg';
  const focusPulse = animate && cinematicCamera
    ? cameraBeat.interpolate({
      inputRange: [0, 1, 1.8, 2, 2.55, 3, 4, 5.8, 6, 6.45, 7, 8],
      outputRange: [0, 0, 0, 0.42, 0.2, 0, 0, 0, 0.36, 0.16, 0, 0],
    })
    : 0;
  const beatFlash = animate && cinematicCamera
    ? cameraBeat.interpolate({
      inputRange: [0, 1.85, 2, 2.18, 2.55, 5.85, 6, 6.16, 6.45, 9],
      outputRange: [0, 0, 0.1 * cameraEnergy, 0.06 * cameraEnergy, 0, 0, 0.08 * cameraEnergy, 0.05 * cameraEnergy, 0, 0],
    })
    : 0;
  const entryScale = transition === 'zoom' || transition === 'parallax'
    ? entrance.interpolate({ inputRange: [0, 1], outputRange: [1.035, 1] })
    : 1;
  const entryX = transition === 'slide'
    ? entrance.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] })
    : 0;
  const entryY = transition === 'pan'
    ? entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] })
    : 0;
  const entranceOpacity = transition === 'fade'
    ? entrance.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] })
    : 1;
  const lightSweepX = animate
    ? cycle.interpolate({ inputRange: [0, 1], outputRange: [-190, 190] })
    : 0;
  const lightSweepOpacity = animate && style ? glowOpacity : cinematicCamera && animate ? 0.34 : 0.18;
  const blurredChild = cinematicCamera && React.isValidElement(children)
    ? React.cloneElement(
      children as React.ReactElement<{ blurRadius?: number; style?: StyleProp<ImageStyle> }>,
      {
        blurRadius: 9,
        style: [
          (children as React.ReactElement<{ style?: StyleProp<ImageStyle> }>).props.style,
          StyleSheet.absoluteFill,
        ],
      },
    )
    : null;
  const cutOpacity = hasEditorialCuts && animate
    ? cameraBeat.interpolate({
      inputRange: [0, 1.7, 1.9, 2, 2.5, 2.78, 3, 5.7, 5.9, 6, 6.5, 6.78, 7, 9],
      outputRange: [0, 0, 0.5 * cutStrength, cutStrength, 0.86 * cutStrength, 0.38 * cutStrength, 0, 0, 0.5 * cutStrength, cutStrength, 0.86 * cutStrength, 0.38 * cutStrength, 0, 0],
    })
    : 0;
  const colorGradeOpacity = animate && cinematicCamera
    ? cameraBeat.interpolate({
      inputRange: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      outputRange: [0.05, 0.11, 0.18, 0.12, 0.06, 0.1, 0.18, 0.12, 0.07, 0.05].map(value => value * tintEnergy),
    })
    : 0;

  return (
    <View
      style={[StyleSheet.absoluteFill, showcaseStyles.stage]}
      pointerEvents="box-none"
      onLayout={({ nativeEvent: { layout } }) => {
        if (layout.width > 0 && layout.height > 0
          && (layout.width !== stageSize.width || layout.height !== stageSize.height)) {
          setStageSize({ width: layout.width, height: layout.height });
        }
      }}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            zIndex: 1,
            opacity: entranceOpacity,
            transform: [
              { translateX: entryX },
              { translateY: entryY },
              { translateX: cameraX },
              { translateY: cameraY },
              { scale: cameraScale },
              { rotate: cameraRotation },
              { scale: entryScale },
            ],
          },
        ]}
        pointerEvents="none"
      >
        {children}
        {blurredChild ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: focusPulse }]}>
            {blurredChild}
          </Animated.View>
        ) : null}
      </Animated.View>
      {cinematicCamera ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { opacity: beatFlash, backgroundColor: colors.foreground, zIndex: 2 },
          ]}
        />
      ) : null}
      {cinematicCamera ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { opacity: colorGradeOpacity, zIndex: 3 },
          ]}
        >
          <LinearGradient
            colors={[`${vibeAccent}00`, `${vibeAccent}70`, `${colors.background}10`]}
            start={{ x: 0.08, y: 0.12 }}
            end={{ x: 0.92, y: 0.88 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      {hasEditorialCuts && stageSize.width > 0 && stageSize.height > 0 && React.isValidElement(children)
        ? [0, 1, 2].map(index => {
          const panelWidth = stageSize.width / 3;
          const shiftAmount = panelWidth * (index === 1 ? -0.36 : 0.72);
          const panelShift = cameraBeat.interpolate({
            inputRange: [0, 1.72, 1.9, 2, 2.5, 2.78, 3, 5.72, 5.9, 6, 6.5, 6.78, 7, 9],
            outputRange: [
              index === 0 ? -shiftAmount : shiftAmount,
              index === 0 ? -shiftAmount : shiftAmount,
              index === 0 ? -shiftAmount * 0.45 : shiftAmount * 0.45,
              0,
              0,
              index === 0 ? shiftAmount * 0.35 : -shiftAmount * 0.35,
              index === 0 ? shiftAmount : -shiftAmount,
              index === 0 ? shiftAmount : -shiftAmount,
              index === 0 ? -shiftAmount * 0.45 : shiftAmount * 0.45,
              0,
              0,
              index === 0 ? shiftAmount * 0.35 : -shiftAmount * 0.35,
              index === 0 ? shiftAmount : -shiftAmount,
              index === 0 ? shiftAmount : -shiftAmount,
            ],
          });
          const framedImage = React.cloneElement(
            children as React.ReactElement<{ style?: StyleProp<ImageStyle> }>,
            {
              style: {
                position: 'absolute',
                top: 0,
                left: -index * panelWidth,
                width: stageSize.width,
                height: stageSize.height,
              },
            },
          );
          return (
            <Animated.View
              key={`editorial-frame-${index}`}
              pointerEvents="none"
              style={[
                showcaseStyles.editorialPanel,
                {
                  left: panelWidth * index,
                  width: panelWidth,
                  opacity: cutOpacity,
                  transform: [{ translateX: panelShift }],
                },
              ]}
            >
              {framedImage}
              {index > 0 ? (
                <Animated.View
                  style={[
                    showcaseStyles.editorialSeparator,
                    { backgroundColor: vibeAccent, opacity: cutOpacity },
                  ]}
                />
              ) : null}
            </Animated.View>
          );
        })
        : null}

      {style ? (
        <>
        <LinearGradient
          colors={palette}
          style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
          start={{ x: 0.12, y: 0 }}
          end={{ x: 0.88, y: 1 }}
        />
        {style === 'holographic' ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: glowOpacity, zIndex: 0 }]}
          >
            <LinearGradient
              colors={alternatePalette}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.9, y: 0 }}
              end={{ x: 0.1, y: 1 }}
            />
          </Animated.View>
        ) : (
          <Animated.View
            pointerEvents="none"
            style={[showcaseStyles.dreamyGlow, { backgroundColor: `${colors.chart2}38`, opacity: glowOpacity, zIndex: 0 }]}
          />
        )}

        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { opacity: animate ? imageTintOpacity : 0.06, zIndex: 2 },
          ]}
        >
          <LinearGradient
            colors={alternatePalette}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.12, y: 0 }}
            end={{ x: 0.92, y: 1 }}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            showcaseStyles.lightSweep,
            {
              opacity: lightSweepOpacity,
              transform: [{ translateX: lightSweepX }],
            },
          ]}
        >
          <LinearGradient
            colors={[
              `${colors.background}00`,
              `${style === 'dreamy' ? colors.chart2 : colors.chart4}18`,
              `${style === 'dreamy' ? colors.chart2 : colors.chart4}66`,
              `${style === 'dreamy' ? colors.chart2 : colors.chart4}18`,
              `${colors.background}00`,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {style === 'dreamy' ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              showcaseStyles.dreamyOrbit,
              {
                borderColor: `${colors.accent}70`,
                opacity: animate ? glowOpacity : 0.3,
                shadowColor: colors.accent,
                shadowOpacity: 0.38,
                shadowRadius: 18,
                elevation: 5,
                    zIndex: 3,
              },
              animate ? { transform: [{ translateY: floatY }] } : undefined,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              showcaseStyles.dreamyStar,
                  { opacity: animate ? glowOpacity : 0.3, zIndex: 3, transform: animate ? [{ rotate: turn }] : undefined },
            ]}
          >
            <Icon name="sparkles" size={20} color={colors.accent} />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              showcaseStyles.dreamyDot,
                  { backgroundColor: colors.chart2, opacity: animate ? glowOpacity : 0.25, zIndex: 3 },
            ]}
          />
        </>
        ) : (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              showcaseStyles.holoFrame,
              {
                borderColor: colors.chart4,
                opacity: animate ? glowOpacity : 0.4,
                shadowColor: colors.chart4,
                shadowOpacity: 0.45,
                shadowRadius: 18,
                elevation: 5,
                    zIndex: 3,
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              showcaseStyles.holoSquare,
                  { borderColor: colors.accent, zIndex: 3 },
              animate ? { transform: [{ rotate: turn }, { translateY: floatY }] } : undefined,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              showcaseStyles.holoDiamond,
                  { borderColor: colors.chart2, opacity: animate ? glowOpacity : 0.45, zIndex: 3 },
              animate ? { transform: [{ rotate: turn }] } : undefined,
            ]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[`${colors.chart4}00`, `${colors.chart4}30`, `${colors.chart2}00`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[showcaseStyles.holoScanline, { zIndex: 3 }]}
          />
        </>
        )}
        </>
      ) : null}
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  container: { marginTop: 2 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  title: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  hint: { fontSize: 11, lineHeight: 16, fontFamily: 'Satoshi-Regular', marginBottom: 9 },
  choices: { gap: 9, paddingRight: 14, paddingBottom: 2 },
  choice: { width: 145, borderRadius: 15, padding: 6, overflow: 'hidden' },
  preview: { height: 86, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { fontSize: 11, fontFamily: 'Satoshi-Bold', marginTop: 7 },
  choiceDescription: { fontSize: 9, lineHeight: 13, fontFamily: 'Satoshi-Regular', marginTop: 2, minHeight: 26 },
  previewTitle: { position: 'absolute', left: 9, right: 9, bottom: 7, fontSize: 10, fontFamily: 'Satoshi-Bold', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  dreamyPreviewTitle: { fontStyle: 'italic', letterSpacing: 0.2 },
  holoPreviewTitle: { textTransform: 'uppercase', letterSpacing: 0.5 },
  check: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  transitionSection: { marginTop: 8 },
  transitionHeading: { fontSize: 11, fontFamily: 'Satoshi-Bold', marginBottom: 6 },
  transitionChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  transitionChoice: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  transitionChoiceText: { fontSize: 10, fontFamily: 'Satoshi-Medium' },
  dreamyGlow: { ...StyleSheet.absoluteFill, opacity: 0.32 },
  dreamySparkle: { position: 'absolute', top: 9, right: 24 },
  dreamyOrb: { position: 'absolute', left: 10, bottom: 9, width: 28, height: 28, borderWidth: 1, borderRadius: 14 },
  holoBorder: { ...StyleSheet.absoluteFill, margin: 5, borderWidth: 1, borderRadius: 8 },
  holoSquare: { position: 'absolute', top: 9, left: 12, width: 14, height: 14, borderWidth: 1, transform: [{ rotate: '18deg' }] },
  holoDiamond: { position: 'absolute', right: 13, bottom: 12, width: 13, height: 13, borderWidth: 1, transform: [{ rotate: '45deg' }] },
});

const showcaseStyles = StyleSheet.create({
  stage: { overflow: 'hidden' },
  editorialPanel: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden', zIndex: 4 },
  editorialSeparator: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2 },
  dreamyGlow: { position: 'absolute', width: '88%', height: '58%', borderRadius: 999, alignSelf: 'center', top: '19%' },
  dreamyOrbit: { position: 'absolute', top: '17%', left: '7%', right: '7%', height: '66%', borderWidth: 1, borderRadius: 999 },
  dreamyStar: { position: 'absolute', top: '23%', right: '12%' },
  dreamyDot: { position: 'absolute', top: '36%', left: '11%', width: 5, height: 5, borderRadius: 3 },
  holoFrame: { ...StyleSheet.absoluteFill, margin: 14, borderWidth: 1.5, borderRadius: 24 },
  holoSquare: { position: 'absolute', top: '21%', right: '12%', width: 20, height: 20, borderWidth: 1, borderRadius: 3 },
  holoDiamond: { position: 'absolute', bottom: '28%', left: '11%', width: 13, height: 13, borderWidth: 1, transform: [{ rotate: '45deg' }] },
  holoScanline: { position: 'absolute', top: '22%', bottom: '22%', left: 0, right: 0, opacity: 0.25 },
  lightSweep: { position: 'absolute', top: 0, bottom: 0, left: '16%', width: '68%', zIndex: 2 },
});
