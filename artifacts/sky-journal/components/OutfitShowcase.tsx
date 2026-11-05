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
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

type ShowcaseChoice = OutfitShowcaseStyle | 'none';

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
  children,
}: {
  style: OutfitShowcaseStyle | null;
  transition?: OutfitShowcaseTransition;
  children: React.ReactNode;
}) {
  const { isDark } = useTheme();
  const colors = useDesignColors(isDark ? 'dark' : 'light');
  const { animate } = useDecorativeMotion();
  const cycle = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(1)).current;

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

  if (!style) return <>{children}</>;

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
    ? cycle.interpolate({ inputRange: [0, 1], outputRange: cameraScaleRange })
    : 1;
  const cameraX = animate
    ? cycle.interpolate({ inputRange: [0, 1], outputRange: cameraXRange })
    : 0;
  const cameraY = animate
    ? cycle.interpolate({ inputRange: [0, 1], outputRange: cameraYRange })
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
  const lightSweepOpacity = animate ? glowOpacity : 0.18;

  return (
    <View style={[StyleSheet.absoluteFill, showcaseStyles.stage]} pointerEvents="box-none">
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
              { scale: entryScale },
            ],
          },
        ]}
        pointerEvents="none"
      >
        {children}
      </Animated.View>

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
