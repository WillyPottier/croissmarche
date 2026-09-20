import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { formatCountdown, formatEuros } from "@/src/format";
import { radius, spacing, useTheme } from "@/src/theme";
import { Button, Loading, T } from "@/src/ui";

const MIN_PURCHASE_CENTS = 250;

export default function Voucher() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["walker-voucher"], queryFn: () => apiFetch("/walker/voucher") });
  const voucher: any = (q.data as any)?.voucher;

  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!voucher) return;
    const tick = () => {
      const left = Math.floor((new Date(voucher.expiresAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(left);
      if (left <= 0) {
        qc.invalidateQueries({ queryKey: ["walker-voucher"] });
        qc.invalidateQueries({ queryKey: ["walker-home"] });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [voucher, qc]);

  if (q.isLoading) return <Loading testID="voucher-loading" />;

  if (!voucher) {
    return (
      <View
        testID="voucher-empty"
        style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }}
      >
        <View
          style={{
            width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceTertiary,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <T variant="display" style={{ fontSize: 44 }}>🥐</T>
        </View>
        <T variant="title" style={{ textAlign: "center" }}>Aucune contremarque active</T>
        <T variant="body" color={colors.muted} style={{ textAlign: "center" }}>
          Choisis une boulangerie ouverte et crée ta contremarque. Elle sera valable 10 minutes.
        </T>
        <Button
          testID="choose-bakery"
          title="Choisir une boulangerie"
          onPress={() => router.push("/(walker)/(tabs)/home" as any)}
        />
      </View>
    );
  }

  const expired = secondsLeft <= 0;

  return (
    <ScrollView
      testID="voucher-active"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
    >
      <View
        style={{
          backgroundColor: expired ? colors.muted : colors.brandPrimary,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: spacing.xxl,
          paddingHorizontal: spacing.lg,
          alignItems: "center",
          borderBottomLeftRadius: radius.lg,
          borderBottomRightRadius: radius.lg,
        }}
      >
        <T variant="caption" color={colors.onBrandPrimary}>MA CONTREMARQUE</T>
        <T variant="body" color={colors.onBrandPrimary} style={{ opacity: 0.9, marginTop: 4 }}>
          {voucher.partnerName}
        </T>

        <View
          style={{
            marginTop: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.xl,
            alignItems: "center",
          }}
        >
          <T variant="display" testID="voucher-code" style={{ fontSize: 84, letterSpacing: 10 }}>
            {voucher.code}
          </T>
        </View>

        <View style={{ marginTop: spacing.lg, alignItems: "center" }}>
          <T variant="caption" color={colors.onBrandPrimary}>{expired ? "EXPIRÉE" : "EXPIRE DANS"}</T>
          <T variant="display" color={colors.onBrandPrimary} testID="voucher-countdown" style={{ fontSize: 40 }}>
            {formatCountdown(secondsLeft)}
          </T>
        </View>
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <T variant="subtitle">Au comptoir</T>
        <T variant="body" color={colors.onSurfaceTertiary}>
          Lis ces 4 chiffres au boulanger : il les saisit sur sa page de validation.
        </T>
        <View style={{ backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md }}>
          <T variant="label" color={colors.onSurfaceTertiary}>À rappeler</T>
          <T variant="body" color={colors.onSurfaceTertiary} style={{ marginTop: 4 }}>
            Minimum {formatEuros(MIN_PURCHASE_CENTS)} d'achat pour une viennoiserie offerte.
          </T>
        </View>
        {expired ? (
          <Button title="Retour à l'accueil" onPress={() => router.push("/(walker)/(tabs)/home" as any)} variant="secondary" />
        ) : null}
      </View>
    </ScrollView>
  );
}
