import { RoleTabs } from "@/src/tabs";

export default function AdminTabs() {
  return (
    <RoleTabs
      items={[
        { name: "dashboard", label: "Tableau" },
        { name: "partners", label: "Partenaires" },
        { name: "users", label: "Marcheurs" },
        { name: "dev", label: "Dev" },
      ]}
    />
  );
}
