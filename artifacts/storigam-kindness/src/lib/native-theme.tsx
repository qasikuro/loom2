import { tokens } from "../generated/tokens";

const toPixels = (value: string) => Number.parseFloat(value) * 16;

const radius = toPixels(tokens.radius);
const spacing = toPixels(tokens.spacing);

export const nativeTheme = {
  light: {
    ...tokens.color.light,
    radius,
    spacing,
    fontFamily: {
      regular: "Satoshi-Regular",
      medium: "Satoshi-Medium",
      bold: "Satoshi-Bold",
    },
  },
  dark: {
    ...tokens.color.dark,
    radius,
    spacing,
    fontFamily: {
      regular: "Satoshi-Regular",
      medium: "Satoshi-Medium",
      bold: "Satoshi-Bold",
    },
  },
} as const;

export type NativeThemeMode = keyof typeof nativeTheme;
export type NativeThemeColors = (typeof nativeTheme)[NativeThemeMode];
