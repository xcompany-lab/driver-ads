import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AuthShell, Field } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpAdvertiser } from "@/lib/auth";
import { roleHome } from "@/hooks/useSession";

export const Route = createFileRoute("/auth/anunciante")({
  head: () => ({ meta: [{ title: "Anunciante — Driver Ads" }] }),
  component: AdvertiserAuth,
});

function AdvertiserAuth() {
  return (
    <AuthShell
      title="Portal do Anunciante"
      subtitle="Gerencie suas campanhas de mídia em movimento."
      expectedRole="advertiser"
      signupNode={<AdvertiserSignup />}
    />
  );
}

function AdvertiserSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", password: "",
    company_name: "", cnpj: "", city: "", segment: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState(false);
  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await signUpAdvertiser(form);
      if (res.needsEmailConfirmation) { setPendingEmail(true); return; }
      navigate({ to: roleHome("advertiser") });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally { setLoading(false); }
  }

  if (pendingEmail) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Enviamos um link de confirmação para <strong>{form.email}</strong>. Confirme o e-mail para finalizar o cadastro.</p>
        <Link to="/auth/anunciante" className="text-sm text-primary underline">Voltar</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field id="company_name" label="Empresa"><Input id="company_name" required value={form.company_name} onChange={update("company_name")} /></Field>
        <Field id="cnpj" label="CNPJ"><Input id="cnpj" required value={form.cnpj} onChange={update("cnpj")} /></Field>
      </div>
      <Field id="full_name" label="Responsável"><Input id="full_name" required value={form.full_name} onChange={update("full_name")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="email" label="E-mail"><Input id="email" type="email" required value={form.email} onChange={update("email")} /></Field>
        <Field id="phone" label="Telefone"><Input id="phone" required value={form.phone} onChange={update("phone")} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="city" label="Cidade"><Input id="city" required value={form.city} onChange={update("city")} /></Field>
        <Field id="segment" label="Segmento"><Input id="segment" value={form.segment} onChange={update("segment")} /></Field>
      </div>
      <Field id="password" label="Senha"><Input id="password" type="password" minLength={6} required value={form.password} onChange={update("password")} /></Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="hero" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Criar conta de anunciante
      </Button>
    </form>
  );
}
