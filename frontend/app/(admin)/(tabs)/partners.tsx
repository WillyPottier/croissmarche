import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api";
import { formatPhone } from "@/src/format";
import { radius, spacing, useTheme } from "@/src/theme";
import { Button, Card, ErrorState, Field, Loading, Pill, T } from "@/src/ui";
import { useToast } from "@/src/toast";

const empty = { businessName: "", address: "", lat: "", lng: "", phone: "", contactName: "" };

export default function Partners() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["admin-partners"], queryFn: () => apiFetch<any[]>("/admin/partners") });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [conflict, setConflict] = useState<string | null>(null);

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: (force: boolean) =>
      apiFetch("/admin/partners", {
        method: "POST",
        body: {
          businessName: form.businessName,
          address: form.address,
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
          phone: form.phone,
          contactName: form.contactName,
          force,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
      qc.invalidateQueries({ queryKey: ["admin-metrics"] });
      toast.show("Partenaire créé.", "success");
      setForm({ ...empty });
      setShowForm(false);
      setConflict(null);
    },
    onError: (e: any) => {
      if (e.status === 409) {
        setConflict(e.message);
      } else {
        toast.show(e.message, "error");
      }
    },
  });

  const pause = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/partners/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
      toast.show("Partenaire mis en pause.", "info");
    },
  });

  if (q.isLoading) return <Loading testID="partners-loading" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  const submit = () => {
    if (!form.businessName || !form.address || !form.lat || !form.lng) {
      toast.show("Nom, adresse, latitude et longitude requis.", "error");
      return;
    }
    setConflict(null);
    create.mutate(false);
  };

  return (
    <KeyboardAwareScrollView
      testID="admin-partners"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
      bottomOffset={20}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T variant="title">Partenaires</T>
        <Button testID="toggle-add-partner" title={showForm ? "Fermer" : "+ Ajouter"} onPress={() => setShowForm((s) => !s)} variant="secondary" style={{ minHeight: 44, paddingHorizontal: spacing.md }} />
      </View>

      {showForm ? (
        <Card testID="add-partner-form">
          <T variant="subtitle" style={{ marginBottom: spacing.sm }}>Nouveau partenaire</T>
          <View style={{ gap: spacing.sm }}>
            <Field testID="np-name" label="Nom" value={form.businessName} onChangeText={(v) => set("businessName", v)} placeholder="Boulangerie du Centre" />
            <Field testID="np-address" label="Adresse" value={form.address} onChangeText={(v) => set("address", v)} placeholder="12 Rue de la Loge, 66000 Perpignan" />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}><Field testID="np-lat" label="Latitude" value={form.lat} onChangeText={(v) => set("lat", v)} keyboardType="numbers-and-punctuation" placeholder="42.6986" /></View>
              <View style={{ flex: 1 }}><Field testID="np-lng" label="Longitude" value={form.lng} onChangeText={(v) => set("lng", v)} keyboardType="numbers-and-punctuation" placeholder="2.8954" /></View>
            </View>
            <Field testID="np-phone" label="Téléphone" value={form.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" placeholder="04 68 00 00 00" />
            <Field testID="np-contact" label="Contact" value={form.contactName} onChangeText={(v) => set("contactName", v)} placeholder="Nom du contact" />
          </View>

          {conflict ? (
            <View style={{ marginTop: spacing.md, backgroundColor: "#FBEBD3", borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }}>
              <T variant="label" color="#9A6B12">Exclusivité 500 m</T>
              <T variant="caption" color={colors.onSurfaceTertiary}>{conflict}</T>
              <Button testID="force-create" title="Créer quand même" onPress={() => create.mutate(true)} loading={create.isPending} variant="danger" />
            </View>
          ) : (
            <Button testID="submit-partner" title="Créer le partenaire" onPress={submit} loading={create.isPending} style={{ marginTop: spacing.md }} />
          )}
        </Card>
      ) : null}

      {(q.data || []).map((p) => (
        <Card key={p.id} testID={`admin-partner-${p.id}`}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <T variant="subtitle" style={{ fontSize: 18 }}>{p.businessName}</T>
              <T variant="caption" style={{ marginTop: 2 }}>{p.address}</T>
              {p.phone ? <T variant="caption">{formatPhone(p.phone)}</T> : null}
              <T variant="caption" style={{ marginTop: 2 }}>Créneau {String(p.offPeakStart).replace(":", "h")}–{String(p.offPeakEnd).replace(":", "h")}</T>
            </View>
            <Pill label={p.plan === "ACTIVE" ? "ACTIVE" : "EN PAUSE"} tone={p.plan === "ACTIVE" ? "success" : "muted"} />
          </View>
          {p.plan === "ACTIVE" ? (
            <Pressable testID={`pause-${p.id}`} onPress={() => pause.mutate(p.id)} style={{ marginTop: spacing.sm }}>
              <T variant="label" color={colors.error}>Mettre en pause</T>
            </Pressable>
          ) : null}
        </Card>
      ))}
    </KeyboardAwareScrollView>
  );
}
