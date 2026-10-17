/**
 * Layered Lumi built from the original SVG pack. Each layer is a static
 * SvgXml inside a native Animated.View; only View transforms/opacity animate
 * (no animated <G> transforms). Pivots use translate-rotate-translate around
 * the art-space pivot, scaled to the rendered size.
 */
import React, { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { BODY_ART, PIVOTS } from './art/body';
import { FACE_ART } from './art/face';
import { PROP_ART } from './art/props';
import { useLumiRig, type LumiExpression, type RigValues } from './useLumiRig';
import { useLumiActivity } from './useLumiActivity';

const C = 256;

const Layer = memo(function Layer({ xml, size }: { xml: string; size: number }) {
  return <SvgXml xml={xml} width={size} height={size} />;
});

function rotAbout(px: number, py: number, deg: number, k: number) {
  'worklet';
  const dx = (px - C) * k;
  const dy = (py - C) * k;
  return [
    { translateX: dx }, { translateY: dy }, { rotate: `${deg}deg` },
    { translateX: -dx }, { translateY: -dy },
  ];
}

function scaleAbout(px: number, py: number, sx: number, sy: number, k: number) {
  'worklet';
  const dx = (px - C) * k;
  const dy = (py - C) * k;
  return [
    { translateX: dx }, { translateY: dy }, { scaleX: sx }, { scaleY: sy },
    { translateX: -dx }, { translateY: -dy },
  ];
}

export const LumiRigView = memo(function LumiRigView({ v, size }: { v: RigValues; size: number }) {
  const k = size / 512;

  const shadow = useAnimatedStyle(() => {
    const lift = -(v.float.value + v.hop.value); // >= 0 when airborne
    const s = 1 - Math.min(lift, 40) / 160;
    return { opacity: 1 - Math.min(lift, 40) / 90, transform: scaleAbout(256, 450, s, s, k) };
  });

  const root = useAnimatedStyle(() => {
    const reach = 1 + v.reach.value * 0.06;
    return {
      transform: [
        { translateY: (v.float.value + v.hop.value) * k },
        { translateX: v.lean.value * k },
        ...rotAbout(PIVOTS.ground.x, PIVOTS.ground.y, v.bodyRot.value, k),
        ...scaleAbout(PIVOTS.ground.x, PIVOTS.ground.y, reach, reach, k),
      ],
    };
  });

  const body = useAnimatedStyle(() => {
    const b = v.breathe.value * 0.018;
    const sq = v.squash.value * 0.05;
    return { transform: scaleAbout(PIVOTS.ground.x, PIVOTS.ground.y, 1 + b * 0.5 + sq, 1 + b - sq, k) };
  });

  const face = useAnimatedStyle(() => ({
    transform: [
      { translateX: v.faceX.value * k },
      { translateY: (v.faceY.value - v.breathe.value * 2 + v.squash.value * 6) * k },
      ...rotAbout(PIVOTS.face.x, PIVOTS.face.y, v.faceRot.value + v.tilt.value * 4, k),
    ],
  }));

  const eyeOpen = (px: number, py: number) => {
    'worklet';
    const closed = Math.max(v.blink.value, v.shut.value);
    const w = 1 + v.wide.value * 0.08;
    return { opacity: closed > 0.95 ? 0 : 1, transform: scaleAbout(px, py, w, Math.max(0.06, (1 - closed) * w), k) };
  };
  const eyeL = useAnimatedStyle(() => eyeOpen(PIVOTS.eyeLeft.x, PIVOTS.eyeLeft.y));
  const eyeR = useAnimatedStyle(() => eyeOpen(PIVOTS.eyeRight.x, PIVOTS.eyeRight.y));
  const pupils = useAnimatedStyle(() => ({
    transform: [
      { translateX: (v.lookX.value + v.glance.value * 7) * k },
      { translateY: v.lookY.value * k },
    ],
  }));
  const closedLines = useAnimatedStyle(() => ({ opacity: v.shut.value > 0.5 || v.blink.value > 0.85 ? 1 : 0 }));
  const lids = useAnimatedStyle(() => ({ opacity: v.lids.value }));
  const blush = useAnimatedStyle(() => ({ opacity: 0.55 + v.blush.value * 0.45, transform: scaleAbout(256, 319, 1 + v.blush.value * 0.12, 1 + v.blush.value * 0.12, k) }));
  const brows = useAnimatedStyle(() => ({ opacity: v.brows.value, transform: [{ translateY: -v.brows.value * 4 * k }] }));
  const mSmile = useAnimatedStyle(() => ({ opacity: 1 - Math.max(v.mLaugh.value, v.mOpen.value, v.mSad.value) }));
  const mLaugh = useAnimatedStyle(() => ({ opacity: v.mLaugh.value * (1 - v.mOpen.value) }));
  const mOpen = useAnimatedStyle(() => ({ opacity: v.mOpen.value }));
  const mSad = useAnimatedStyle(() => ({ opacity: v.mSad.value * (1 - v.mLaugh.value) }));

  const arms = useAnimatedStyle(() => ({ opacity: 1 - Math.max(v.armsOpen.value, v.cover.value) }));
  const armL = useAnimatedStyle(() => ({
    transform: rotAbout(PIVOTS.shoulderLeft.x, PIVOTS.shoulderLeft.y, v.armL.value + v.sway.value * 3 - v.breathe.value * 2, k),
  }));
  const armR = useAnimatedStyle(() => ({
    transform: rotAbout(PIVOTS.shoulderRight.x, PIVOTS.shoulderRight.y, v.armR.value - v.sway.value * 3 + v.breathe.value * 2, k),
  }));
  const legL = useAnimatedStyle(() => ({ transform: rotAbout(PIVOTS.hipLeft.x, PIVOTS.hipLeft.y, v.legL.value + v.hop.value * 0.25, k) }));
  const legR = useAnimatedStyle(() => ({ transform: rotAbout(PIVOTS.hipRight.x, PIVOTS.hipRight.y, v.legR.value - v.hop.value * 0.25, k) }));
  const sprout = useAnimatedStyle(() => ({
    transform: [
      { translateY: (-v.breathe.value * 3 + v.squash.value * 8) * k },
      ...rotAbout(PIVOTS.sprout.x, PIVOTS.sprout.y, v.sprout.value + v.sway.value * 3 + v.faceRot.value * 0.4, k),
    ],
  }));
  const leafL = useAnimatedStyle(() => ({ transform: rotAbout(PIVOTS.leafBase.x, PIVOTS.leafBase.y, -v.sway.value * 4 - v.hop.value * 0.3, k) }));
  const leafR = useAnimatedStyle(() => ({ transform: rotAbout(PIVOTS.leafBase.x, PIVOTS.leafBase.y, v.sway.value * 4 + v.hop.value * 0.3, k) }));

  const armsOpen = useAnimatedStyle(() => ({ opacity: v.armsOpen.value }));
  const cover = useAnimatedStyle(() => ({ opacity: v.cover.value, transform: [{ translateY: (1 - v.cover.value) * 30 * k }] }));
  const heart = useAnimatedStyle(() => {
    const p = v.heart.value;
    return {
      opacity: p <= 0 || p >= 1 ? 0 : interpolate(p, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
      transform: [{ translateX: 120 * k }, { translateY: (-150 - p * 70) * k }, { scale: 0.3 + Math.min(p, 0.2) * 0.75 }],
    };
  });
  const hearts = useAnimatedStyle(() => ({ opacity: v.hearts.value, transform: [{ translateY: (-40 - v.hearts.value * 20) * k }] }));
  const sparkle = (dx: number, dy: number, s: number, phase: number) => {
    'worklet';
    const p = v.sparkle.value;
    return { opacity: p, transform: [{ translateX: dx * k }, { translateY: (dy - p * 14) * k }, { scale: s * (0.5 + p * 0.5) }, { rotate: `${phase + p * 40}deg` }] };
  };
  const sp1 = useAnimatedStyle(() => sparkle(-175, -150, 0.32, 0));
  const sp2 = useAnimatedStyle(() => sparkle(180, -110, 0.24, 20));
  const sp3 = useAnimatedStyle(() => sparkle(-200, 40, 0.18, 10));
  const zzz = useAnimatedStyle(() => ({ opacity: v.zzz.value, transform: [{ translateX: 30 * k }, { translateY: (-150 - (1 - v.zzz.value) * 20) * k }, { scale: 0.7 }] }));
  const sweat = useAnimatedStyle(() => ({ opacity: v.sweat.value, transform: [{ translateY: (v.sweat.value * 8) * k }] }));

  const L = (style: object, xml: string) => (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Layer xml={xml} size={size} />
    </Animated.View>
  );

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {L(shadow, BODY_ART.shadow)}
      <Animated.View style={[StyleSheet.absoluteFill, root]}>
        {L(legL, BODY_ART.legLeft)}
        {L(legR, BODY_ART.legRight)}
        {L(body, BODY_ART.body)}
        <Animated.View style={[StyleSheet.absoluteFill, face]}>
          {L(blush, FACE_ART.blush)}
          <Animated.View style={[StyleSheet.absoluteFill, eyeL]}>
            <Layer xml={FACE_ART.eyeWhiteLeft} size={size} />
            <Animated.View style={[StyleSheet.absoluteFill, pupils]}><Layer xml={FACE_ART.pupilLeft} size={size} /></Animated.View>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, eyeR]}>
            <Layer xml={FACE_ART.eyeWhiteRight} size={size} />
            <Animated.View style={[StyleSheet.absoluteFill, pupils]}><Layer xml={FACE_ART.pupilRight} size={size} /></Animated.View>
          </Animated.View>
          {L(closedLines, FACE_ART.eyesClosed)}
          {L(lids, FACE_ART.eyelids)}
          {L(brows, FACE_ART.brows)}
          {L(mSmile, FACE_ART.mouthSmile)}
          {L(mLaugh, FACE_ART.mouthLaugh)}
          {L(mOpen, FACE_ART.mouthSurprised)}
          {L(mSad, FACE_ART.mouthSad)}
          {L(sweat, PROP_ART.sweat)}
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, arms]}>
          {L(armL, BODY_ART.armLeft)}
          {L(armR, BODY_ART.armRight)}
        </Animated.View>
        {L(armsOpen, PROP_ART.armsOpen)}
        {L(cover, PROP_ART.coverLeft)}
        {L(cover, PROP_ART.coverRight)}
        <Animated.View style={[StyleSheet.absoluteFill, sprout]}>
          {L({}, BODY_ART.stem)}
          {L(leafL, BODY_ART.leafLeft)}
          {L(leafR, BODY_ART.leafRight)}
        </Animated.View>
      </Animated.View>
      {L(hearts, PROP_ART.smallHearts)}
      {L(heart, PROP_ART.heart)}
      {L(zzz, PROP_ART.zzz)}
      {L(sp1, PROP_ART.sparkle)}
      {L(sp2, PROP_ART.sparkle)}
      {L(sp3, PROP_ART.sparkle)}
    </View>
  );
});

/**
 * Self-contained Lumi with idle motion and a static expression — used outside
 * home (e.g. the companion screen header). No reactions, no events.
 */
export function LumiAvatar({ size, expression = 'neutral', active = true }: { size: number; expression?: LumiExpression; active?: boolean }) {
  const activity = useLumiActivity();
  const rig = useLumiRig({ active: active && activity.active, reducedMotion: activity.reducedMotion });
  const v = rig.values;
  useEffect(() => {
    const to = (sv: typeof v.mLaugh, n: number) => { sv.value = withTiming(n, { duration: 260 }); };
    to(v.mLaugh, expression === 'happy' || expression === 'excited' || expression === 'proud' ? 1 : 0);
    to(v.wide, expression === 'excited' ? 1 : 0);
    to(v.brows, expression === 'focused' ? 1 : 0);
    to(v.lids, expression === 'sleepy' ? 1 : 0);
    to(v.blush, expression === 'proud' ? 1 : 0);
    to(v.lookY, expression === 'focused' ? 5 : 0);
  }, [expression, v]);
  return <LumiRigView v={v} size={size} />;
}
