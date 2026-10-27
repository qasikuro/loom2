import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  anchorFromMeasure,
  compactAvatarCenterX,
  compactAvatarCenterY,
  getAvatarFlight,
  COMPACT_AVATAR_SIZE,
  PULL_RANGE,
} from '../../components/profile/profileScrollGeometry';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('avatar flight geometry', () => {
  it('lands exactly in the compact slot on compact and wide screens', () => {
    for (const w of [320, 375, 430, 768, 1280]) {
      // Wide screens center a 720px column; anchor is root-relative so it already includes the offset.
      const centerX = w / 2;
      for (const topInset of [0, 20, 47, 59, 67]) {
        const f = getAvatarFlight({ centerX, centerY: topInset + 120, avatarSize: 96, range: 150, topInset });
        expect(centerX + f.translateX.outputRange[1]).toBe(compactAvatarCenterX());
        // Screen Y at landing = centerY - scroll(R) + content-follow(R) + ty; overlay is outside the scroll.
        expect(topInset + 120 + f.translateY.outputRange[2]).toBe(compactAvatarCenterY(topInset));
        expect(f.scale.outputRange[2] * 96).toBeCloseTo(COMPACT_AVATAR_SIZE);
      }
    }
  });

  it('fits the complete frame artwork inside the compact slot', () => {
    const flight = getAvatarFlight({
      centerX: 220,
      centerY: 140,
      avatarSize: 104,
      avatarBoxSize: 128,
      range: 180,
      topInset: 24,
    });
    expect(flight.scale.outputRange[2] * 128).toBeCloseTo(COMPACT_AVATAR_SIZE);
    expect(flight.scale.outputRange[2] * 104).toBeLessThan(COMPACT_AVATAR_SIZE);
    expect(flight.decor.inputRange[0]).toBeCloseTo(180 * 0.65);
    expect(flight.decor.outputRange[1]).toBe(0);
  });

  it('offsets the compact slot after a back button', () => {
    expect(compactAvatarCenterX(true) - compactAvatarCenterX(false)).toBe(52);
  });

  it('converts window measurements into a scroll-0 root anchor (offline banner, centered column)', () => {
    const a = anchorFromMeasure({ slotX: 380, slotY: 200, slotW: 128, slotH: 128, rootX: 0, rootY: 0, scrollOffset: 40 });
    expect(a).toEqual({ centerX: 444, centerY: 304 });
    const b = anchorFromMeasure({ slotX: 100, slotY: 150, slotW: 124, slotH: 124, rootX: 0, rootY: 30, scrollOffset: 0 });
    expect(b.centerY).toBe(182);
  });

  it('clamps degenerate input and pull-down', () => {
    const f = getAvatarFlight({ centerX: NaN, centerY: Infinity, avatarSize: 0, range: -5, topInset: -10 });
    expect(f.range).toBe(1);
    expect(f.endScale).toBeLessThanOrEqual(1);
    expect(f.translateX.outputRange.every(Number.isFinite)).toBe(true);
    expect(f.translateY.outputRange.every(Number.isFinite)).toBe(true);
    expect(f.scale.inputRange[0]).toBe(-PULL_RANGE);
    expect(f.scale.outputRange[0]).toBeGreaterThan(1);
    expect(f.barCollapseAt).toBeGreaterThanOrEqual(0);
  });

  it('both routes use the shared measured flight overlay and compact bar', () => {
    const tab = read('app/(tabs)/profile.tsx');
    const pub = read('app/user/[userId].tsx');
    for (const src of [tab, pub]) {
      expect(src).toContain('useAvatarAnchor');
      expect(src).toContain('<AvatarFlightOverlay');
      expect(src).toContain('useProfileCollapse');
      expect(src).toContain('avatarSlotOnly={!!anchor}');
    }
    expect(pub).not.toContain('<AuraBanner');
    expect(tab).toContain('coverImageUri={null}');
    const flight = read('components/profile/ProfileAvatarFlight.tsx');
    expect(flight).not.toMatch(/setState|useState\([^)]*\)[^;]*scroll/);
    // Founder regalia wraps the entire info card (incl. Founder panel), gated as before.
    const card = pub.slice(pub.indexOf('testID="public-profile-info-card"'), pub.indexOf('{/* Gallery filter */}'));
    expect(card).toContain('{hasRegalia && <FounderAuroraCardFrame />}');
    expect(card).toContain('publicProfile.founderTitle');
    expect(pub).toContain("profile?.activeCardFrame === 'card_frame_founder_regalia'");
    // Travel range is measured from layout, not hard-coded.
    expect(tab).toContain('onBioLayout={handleBioLayout}');
    expect(pub).toContain('handlePanelsLayout(e.nativeEvent.layout.y)');
    // Single gallery grid with stable geometry and the safety link outside it.
    expect(pub).toContain('testID="public-gallery-grid"');
    expect(pub).toContain('height: tileW * 1.3');
    expect(pub.indexOf("t('discover.reportProfile')")).toBeGreaterThan(pub.indexOf('testID="public-gallery-grid"'));
    expect(pub).not.toContain("defaultValue: 'Gallery'");
    const bar = read('components/profile/ProfileCollapseBar.tsx');
    expect(bar).toContain('useNativeDriver: true');
    expect(flight).toContain('zIndex: 48');
  });
});
