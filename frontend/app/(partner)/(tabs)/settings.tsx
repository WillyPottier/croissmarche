import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { radius, spacing, useTheme } from "@/src/theme";
import { Button, Card, Field, Loading, Pill, T } from "@/src/ui";
import { useToast } from "@/src/toast";

const DAYS = [
  { i: 0, l: "Lun" }, { i: 1, l: "Mar" }, { i: 2, l: "Mer" }, { i: 3, l: "Jeu" },
  { i: 4, l: "Ven" }, { i: 5, l: "Sam" }, { i: 6, l: "Dim" },
];

export default function Settings() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["partner-me"], queryFn: () => apiFetch("/partner/me") });

  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("17:00");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [reward, setReward] = useState("");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const p: any = q.data;
    if (p) {
      setStart(p.offPeakStart);
      setEnd(p.offPeakEnd);
      setDays(p.offPeakDays || []);
      setReward(p.reward);
      setPaused(p.plan === "PAUSED");
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch("/partner/settings", {
        method: "PUT",
        body: {
          offPeakStart: start,
          offPeakEnd: end,
          offPeakDays: days,
          reward,
          plan: paused ? "PAUSED" : "ACTIVE",
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner-me"] });
      toast.show("Réglages enregistrés.", "success");
    },
    onError: (e: any) => toast.show(e.message, "error"),
  });

  if (q.isLoading) return <Loading testID="settings-loading" />;

  const toggleDay = (i: number) =>
    setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort()));

  return (
    <KeyboardAwareScrollView
      testID="partner-settings"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
      bottomOffset={20}
    >
      <T variant="title">Réglages</T>

      <Card>
        <T variant="subtitle">Créneau d'utilisation</T>
        <T variant="caption" style={{ marginTop: 2 }}>Heures où les contremarques sont acceptées (24h).</T>
        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Field testID="offpeak-start" label="De" value={start} onChangeText={setStart} placeholder="14:00" />
          </View>
          <View style={{ flex: 1 }}>
            <Field testID="offpeak-end" label="À" value={end} onChangeText={setEnd} placeholder="17:00" />
          </View>
        </View>
        <T variant="label" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>Jours</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {DAYS.map((d) => {
            const on = days.includes(d.i);
            return (
              <Pressable
                key={d.i}
                testID={`day-${d.i}`}
                onPress={() => toggleDay(d.i)}
                style={{
                  paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill,
                  backgroundColor: on ? colors.brandPrimary : colors.surfaceTertiary,
                }}
              >
                <T variant="label" color={on ? colors.onBrandPrimary : colors.onSurfaceTertiary}>{d.l}</T>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <T variant="subtitle">Récompense</T>
        <Field
          testID="reward-input"
          value={reward}
          onChangeText={setReward}
          multiline
          placeholder="Une viennoiserie offerte pour tout achat de 2,50 € minimum"
          style={{ minHeight: 80, textAlignVertical: "top", marginTop: spacing.sm }}
        />
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <T variant="subtitle">Boulangerie en pause</T>
            <T variant="caption" style={{ marginTop: 2 }}>Suspend l'acceptation des contremarques.</T>
          </View>
          <Pressable
            testID="toggle-pause"
            onPress={() => setPaused((p) => !p)}
            style={{ width: 58, height: 32, borderRadius: radius.pill, backgroundColor: paused ? colors.error : colors.success, justifyContent: "center", padding: 3 }}
          >
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFFFFF", alignSelf: paused ? "flex-start" : "flex-end" }} />
          </Pressable>
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <Pill label={paused ? "EN PAUSE" : "ACTIVE"} tone={paused ? "muted" : "success"} />
        </View>
      </Card>

      <Button testID="save-settings" title="Enregistrer" onPress={() => save.mutate()} loading={save.isPending} />
    </KeyboardAwareScrollView>
  );
}
