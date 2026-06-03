import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AuthShell, Field } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpDriver } from "@/lib/auth";
import { roleHome } from "@/hooks/useSession";

export const Route = createFileRoute("/auth/motorista")({
  head: () => ({ meta: [{ title: "Motorista — Driver Ads" }] }),
  component: DriverAuth,
});

function DriverAuth() {
  return (
    <AuthShell
      title="Portal do Motorista"
      subtitle="Monetize seu veículo com campanhas Driver Ads."
      expectedRole="driver"
      signupNode={<DriverSignup />}
    />
  );
}

function DriverSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", cpf: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState(false);
  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await signUpDriver(form);
      if (res.needsEmailConfirmation) { setPendingEmail(true); return; }
      navigate({ to: roleHome("driver") });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally { setLoading(false); }
  }

  if (pendingEmail) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Enviamos um link de confirmação para <strong>{form.email}</strong>. Confirme o e-mail para finalizar o cadastro.</p>
        <Link to="/auth/motorista" className="text-sm text-primary underline">Voltar</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="full_name" label="Nome completo"><Input id="full_name" required value={form.full_name} onChange={update("full_name")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="cpf" label="CPF"><Input id="cpf" required value={form.cpf} onChange={update("cpf")} /></Field>
        <Field id="city" label="Cidade"><Input id="city" required value={form.city} onChange={update("city")} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="email" label="E-mail"><Input id="email" type="email" required value={form.email} onChange={update("email")} /></Field>
        <Field id="phone" label="Telefone"><Input id="phone" required value={form.phone} onChange={update("phone")} /></Field>
      </div>
      <Field id="password" label="Senha"><Input id="password" type="password" minLength={6} required value={form.password} onChange={update("password")} /></Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="hero" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Criar conta de motorista
      </Button>
    </form>
  );
}
