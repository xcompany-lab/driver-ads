import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/auth/admin")({
  head: () => ({ meta: [{ title: "Admin — Driver Ads" }] }),
  component: AdminAuth,
});

function AdminAuth() {
  return (
    <AuthShell
      title="Equipe Driver Ads"
      subtitle="Acesso restrito à operação. Cadastros são feitos por convite interno."
      expectedRole={["admin", "operator"]}
      allowSignup={false}
    />
  );
}
