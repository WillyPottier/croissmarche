import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

import { fonts, makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Variant =
  | "display"
  | "title"
  | "subtitle"
  | "body"
  | "label"
  | "caption"
  | "number";

export function T({
  variant = "body",
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  const s = useTextStyles();
  return <Text {...rest} style={[s[variant], color ? { color } : null, style]} />;
}

const useTextStyles = makeStyles((c) => ({
  display: { fontFamily: fonts.display, fontWeight: "700", fontSize: 44, lineHeight: 48, color: c.onSurface },
  title: { fontFamily: fonts.display, fontWeight: "600", fontSize: 26, lineHeight: 32, color: c.onSurface },
  subtitle: { fontFamily: fonts.display, fontWeight: "600", fontSize: 20, lineHeight: 26, color: c.onSurface },
  body: { fontFamily: fonts.text, fontWeight: "400", fontSize: 16, lineHeight: 23, color: c.onSurface },
  label: { fontFamily: fonts.text, fontWeight: "600", fontSize: 14, lineHeight: 18, color: c.onSurface },
  caption: { fontFamily: fonts.text, fontWeight: "500", fontSize: 13, lineHeight: 17, color: c.muted },
  number: { fontFamily: fonts.text, fontWeight: "700", fontSize: 20, color: c.onSurface },
}));

export function Card({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}) {
  const s = useCardStyles();
  return (
    <View testID={testID} style={[s.card, style]}>
      {children}
    </View>
  );
}

const useCardStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: "#7A4618",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
}));

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  testID,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const s = useButtonStyles();
  const isDisabled = disabled || loading;
  const bg =
    variant === "primary"
      ? colors.brandPrimary
      : variant === "secondary"
        ? colors.brandTertiary
        : variant === "danger"
          ? colors.error
          : "transparent";
  const fg =
    variant === "primary"
      ? colors.onBrandPrimary
      : variant === "secondary"
        ? colors.onBrandTertiary
        : variant === "danger"
          ? colors.onError
          : colors.brandSecondary;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (isDisabled) return;
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1 },
        variant === "ghost" ? { borderWidth: 0 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[s.label, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const useButtonStyles = makeStyles(() => ({
  btn: {
    minHeight: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  label: { fontFamily: fonts.text, fontWeight: "700", fontSize: 17 },
}));

export function Pill({
  label,
  tone = "neutral",
  testID,
}: {
  label: string;
  tone?: "success" | "muted" | "warning" | "neutral";
  testID?: string;
}) {
  const { colors } = useTheme();
  const map = {
    success: { bg: "#E5F0E1", fg: colors.success },
    muted: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
    warning: { bg: "#FBEBD3", fg: "#9A6B12" },
    neutral: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
  }[tone];
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: map.bg,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 5,
        borderRadius: radius.pill,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontFamily: fonts.text, fontWeight: "700", fontSize: 12.5, color: map.fg }}>
        {label}
      </Text>
    </View>
  );
}

export function Field({
  label,
  style,
  testID,
  ...rest
}: TextInputProps & { label?: string; testID?: string }) {
  const { colors } = useTheme();
  const s = useFieldStyles();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        style={[s.input, style]}
        {...rest}
      />
    </View>
  );
}

const useFieldStyles = makeStyles((c) => ({
  label: { fontFamily: fonts.text, fontWeight: "600", fontSize: 14, color: c.onSurfaceTertiary },
  input: {
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.text,
    fontSize: 16,
    color: c.onSurface,
  },
}));

export function Loading({ testID }: { testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
      <ActivityIndicator size="large" color={colors.brandSecondary} />
    </View>
  );
}

export function ErrorState({ message, onRetry, testID }: { message?: string; onRetry?: () => void; testID?: string }) {
  return (
    <View testID={testID} style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }}>
      <T variant="subtitle" style={{ textAlign: "center" }}>Oups…</T>
      <T variant="body" color="#8C7765" style={{ textAlign: "center" }}>
        {message || "Impossible de charger les données."}
      </T>
      {onRetry ? <Button title="Réessayer" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}
