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
  it('travel mark only translates and stops on unmount', () => {
    expect(sky).toMatch(/translateX/);
    expect(sky).not.toMatch(/rotate/);
    expect(sky).toMatch(/movement\.stop\(\)/);
    expect(sky).toMatch(/position\.stopAnimation\(\)/);
    expect(sky).toMatch(/if \(reduceMotion\)/);
    expect(sky).toMatch(/position\.setValue\(0\.5\)/);
  });
  it('splash keeps the full brand and releases touches', () => {
    const splash = read('components/AppSplashScreen.tsx');
    expect(splash).toMatch(/StorigamFluidBackdrop/);
    expect(splash).toMatch(/variant="lockup"/);
    expect(splash).toMatch(/pointerEvents="none"/);
  });
});
