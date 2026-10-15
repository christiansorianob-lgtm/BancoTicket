import { exigirAdmin } from "@/lib/sesion";

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  await exigirAdmin();
  return <div className="space-y-5">{children}</div>;
}
