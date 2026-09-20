// Design tokens for Croiss'Marche — warm boulangerie aesthetic, light theme.
// Keys mirror the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FDF8F0",
  onSurface: "#2A1C10",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#2A1C10",
  surfaceTertiary: "#F2D9B0",
  onSurfaceTertiary: "#7A4618",
  surfaceInverse: "#2A1C10",
  onSurfaceInverse: "#FDF8F0",

  brand: "#C97B2C",
  onBrand: "#FFFFFF",
  brandPrimary: "#C97B2C",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#7A4618",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#F2D9B0",
  onBrandTertiary: "#7A4618",

  success: "#4A7C3F",
  onSuccess: "#FFFFFF",
  warning: "#E09F3E",
  onWarning: "#2A1C10",
  error: "#D9534F",
  onError: "#FFFFFF",
  info: "#7DA2A9",
  onInfo: "#FFFFFF",

  border: "#E6D5C3",
  borderStrong: "#C97B2C",
  divider: "#E6D5C3",
  muted: "#8C7765",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// Font families (loaded in app/_layout.tsx via expo-font).
export const fonts = {
  display: "Fraunces",
  text: "Inter",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 };
export const radius = { sm: 8, md: 16, lg: 24, pill: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
