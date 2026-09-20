import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { useAuth } from "@/src/auth";
import { formatEuros } from "@/src/format";
import { radius, spacing, useTheme } from "@/src/theme";
import { Button, T } from "@/src/ui";
import { useToast } from "@/src/toast";

const BG =
  "https://images.unsplash.com/photo-1675125530909-15213f01a9e1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwyfHxjb2ZmZWUlMjBhbmQlMjBtb3JuaW5nJTIwcGFzdHJ5JTIwYWVzdGhldGljfGVufDB8fHx8MTc4OTkxOTQzMXww&ixlib=rb-4.1.0&q=85";

const BENEFITS = [
  "Ta viennoiserie tous les 4 jours au lieu de 9.",
  "Tes Croissants Coins arrivent deux fois plus vite.",
  "Moins d'attente, plus de gourmandise, même effort.",
];

export default function Premium() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { refresh, user } = useAuth();
  const qc = useQueryClient();

  const subscribe = useMutation({
    mutationFn: () => apiFetch("/walker/premium/subscribe", { method: "POST" }),
    onSuccess: async () => {
      await refresh();
      qc.invalidateQueries();
      toast.show("Bienvenue en Premium ! Tu gagnes désormais 2× plus vite.", "success");
      router.back();
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceInverse }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} testID="premium-screen">
        <View style={{ height: 420 }}>
          <Image source={{ uri: BG }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          <LinearGradient
            colors={["rgba(42,28,16,0.15)", "rgba(42,28,16,0.95)"]}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, padding: spacing.lg, paddingTop: insets.top + spacing.md, justifyContent: "space-between" }}
          >
            <Pressable testID="premium-back" onPress={() => router.back()}>
              <T variant="label" color="#FDF8F0">‹ Retour</T>
            </Pressable>
            <View>
              <T variant="caption" color={colors.brandTertiary}>CROISS'MARCHE PREMIUM</T>
              <T variant="display" color="#FDF8F0" style={{ fontSize: 40, lineHeight: 44, marginTop: spacing.sm }}>
                Ta viennoiserie tous les 4 jours au lieu de 9
              </T>
            </View>
          </LinearGradient>
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                <T variant="label" color={colors.onBrandPrimary} style={{ fontSize: 13 }}>✓</T>
              </View>
              <T variant="subtitle" color="#FDF8F0" style={{ flex: 1, fontSize: 18 }}>{b}</T>
            </View>
          ))}
          <T variant="caption" color={colors.brandTertiary} style={{ marginTop: spacing.sm }}>
            Même marche, deux fois plus de Croissants Coins. C'est la vitesse et le confort que tu paies, jamais des CC en plus.
          </T>
        </View>
      </ScrollView>

      <View
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md,
          backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginBottom: spacing.sm }}>
          <T variant="display" style={{ fontSize: 32 }}>{formatEuros(499)}</T>
          <T variant="body" color={colors.muted}> / mois</T>
        </View>
        {user?.plan === "PREMIUM" ? (
          <Button title="Tu es déjà Premium 🥐" onPress={() => router.back()} variant="secondary" />
        ) : (
          <Button testID="subscribe-premium" title="Passer en Premium" onPress={() => subscribe.mutate()} loading={subscribe.isPending} />
        )}
        <T variant="caption" style={{ textAlign: "center", marginTop: spacing.sm }}>
          Paiement désactivé dans ce prototype — activation immédiate pour tester.
        </T>
      </View>
    </View>
  );
}
