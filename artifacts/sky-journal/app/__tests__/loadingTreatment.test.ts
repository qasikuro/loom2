import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('loading treatment', () => {
  const sky = read('components/SkyLoading.tsx');
  it('in-app loaders never render the large lockup or fluid backdrop', () => {
    expect(sky).not.toMatch(/StorigamFluidBackdrop/);
    expect(sky).not.toMatch(/variant="lockup"/);
  });
  it('conversation loader is theme-aware, not hardcoded dark', () => {
    expect(sky).not.toMatch(/themeColors\.dark/);
    expect(sky).toMatch(/backgroundColor: colors\.background/);
    expect(sky).toMatch(/return <CompactWaiting/);
  });
  it('uses the supplied red S/play animation without side-to-side travel', () => {
    const mark = read('components/StorigamAnimatedMark.tsx');
    expect(mark).toMatch(/stroke="#ff2a2a"/);
    expect(mark).toMatch(/Animated\.loop/);
    expect(mark).toMatch(/CIRCLE_PATH/);
    expect(mark).toMatch(/PLAY_PATH/);
    expect(mark).toMatch(/useBrandReducedMotion/);
    expect(sky).not.toMatch(/translateX/);
    expect(sky).toMatch(/StorigamAnimatedMark/);
  });
  it('keeps the original splash and shows the responsive animated mark after it', () => {
    const splash = read('components/AppSplashScreen.tsx');
    expect(splash).toMatch(/useWindowDimensions/);
    expect(splash).toMatch(/StorigamFluidBackdrop dark/);
    expect(splash).toMatch(/variant="lockup"/);
    expect(splash).toMatch(/StorigamAnimatedMark/);
    expect(splash).toMatch(/setTimeout\(\(\) => setShowLoadingMark\(true\), 450\)/);
    expect(splash).toMatch(/pointerEvents="none"/);
    const config = JSON.parse(read('app.json'));
    expect(config.expo.splash.image).toBe('./assets/images/storigam-mark.png');
    expect(config.expo.splash.backgroundColor).toBe('#030014');
    const splashPlugin = config.expo.plugins.find(
      (plugin: string | [string, { image?: string }]) =>
        Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    );
    expect(splashPlugin[1].image).toBe('./assets/images/storigam-mark.png');
  });
});
