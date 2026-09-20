import { RoleTabs } from "@/src/tabs";

export default function WalkerTabs() {
  return (
    <RoleTabs
      items={[
        { name: "home", label: "Accueil" },
        { name: "voucher", label: "Ma contremarque" },
        { name: "history", label: "Historique" },
        { name: "profile", label: "Profil" },
      ]}
    />
  );
}
