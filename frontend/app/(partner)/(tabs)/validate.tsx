import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { formatEuros } from "@/src/format";
import { fonts, radius, spacing, useTheme } from "@/src/theme";
import { Button, Pill, T } from "@/src/ui";
import { useToast } from "@/src/toast";

type Result = { rewardName: string; minPurchaseCents: number; isNewCustomer: boolean };

export default function Validate() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const me = useQuery({ queryKey: ["partner-me"], queryFn: () => apiFetch("/partner/me") });

  const validate = useMutation({
    mutationFn: () => apiFetch<any>("/partner/validate", { method: "POST", body: { code } }),
    onSuccess: (r) => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ rewardName: r.rewardName, minPurchaseCents: r.minPurchaseCents, isNewCustomer: r.isNewCustomer });
      setCode("");
    },
    onError: (e: any) => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.show(e.message, "error");
    },
  });

  const partner: any = me.data;

  const press = (d: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setCode((c) => (c.length >= 4 ? c : c + d));
  };
  const backspace = () => setCode((c) => c.slice(0, -1));
  const clear = () => setCode("");

  // Success overlay — big green confirmation for the baker.
  if (result) {
    return (
      <View testID="validate-success" style={{ flex: 1, backgroundColor: colors.success, padding: spacing.lg, paddingTop: insets.top + spacing.xl, justifyContent: "center", alignItems: "center" }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
          <T variant="display" color="#FFFFFF" style={{ fontSize: 72 }}>✓</T>
        </View>
        <T variant="display" color="#FFFFFF" style={{ fontSize: 40, marginTop: spacing.lg, textAlign: "center" }}>Contremarque validée</T>
        <T variant="subtitle" color="#FFFFFF" style={{ marginTop: spacing.md, textAlign: "center" }}>{result.rewardName}</T>
        <View style={{ marginTop: spacing.md, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.lg }}>
          <T variant="title" color="#FFFFFF">Minimum {formatEuros(result.minPurchaseCents)} d'achat</T>
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Pill label={result.isNewCustomer ? "NOUVEAU CLIENT" : "CLIENT FIDÈLE"} tone={result.isNewCustomer ? "warning" : "neutral"} />
        </View>
        <View style={{ marginTop: spacing.xl, width: "100%", maxWidth: 420 }}>
          <Button testID="new-validation" title="Nouvelle validation" onPress={() => setResult(null)} variant="secondary" />
        </View>
      </View>
    );
  }

  const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];

  return (
    <View testID="partner-validate" style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + spacing.md }}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T variant="subtitle">{partner?.businessName || "Validation"}</T>
          {partner ? (
            <Pill label={partner.availableNow ? "Créneau ouvert" : "Hors créneau"} tone={partner.availableNow ? "success" : "muted"} />
          ) : null}
        </View>
        <T variant="caption" style={{ marginTop: 2 }}>Saisis le code à 4 chiffres dicté par le client</T>
      </View>

      {/* Code display */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.md, marginTop: spacing.lg }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            testID={`code-slot-${i}`}
            style={{
              width: 62, height: 78, borderRadius: radius.md,
              backgroundColor: colors.surfaceSecondary,
              borderWidth: 2, borderColor: code.length === i ? colors.brandPrimary : colors.border,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <T style={{ fontFamily: fonts.display, fontWeight: "700", fontSize: 44 }}>{code[i] || ""}</T>
          </View>
        ))}
      </View>

      {/* Keypad — bottom, big targets for one-handed use */}
      <View style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.md }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.md }}>
          {KEYS.map((k) => (
            <Pressable
              key={k}
              testID={`key-${k}`}
              onPress={() => (k === "C" ? clear() : k === "⌫" ? backspace() : press(k))}
              style={({ pressed }) => ({
                width: "31.5%",
                height: 74,
                borderRadius: radius.md,
                backgroundColor: k === "C" || k === "⌫" ? colors.surfaceTertiary : colors.surfaceSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <T style={{ fontFamily: fonts.display, fontWeight: "600", fontSize: 30, color: colors.onSurface }}>{k}</T>
            </Pressable>
          ))}
        </View>
        <Button
          testID="validate-submit"
          title="Valider la contremarque"
          onPress={() => validate.mutate()}
          loading={validate.isPending}
          disabled={code.length !== 4}
        />
      </View>
    </View>
  );
}
