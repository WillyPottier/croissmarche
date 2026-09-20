import { RoleTabs } from "@/src/tabs";

export default function PartnerTabs() {
  return (
    <RoleTabs
      items={[
        { name: "validate", label: "Validation" },
        { name: "stats", label: "Stats" },
        { name: "settings", label: "Réglages" },
        { name: "billing", label: "Facturation" },
      ]}
    />
  );
}
