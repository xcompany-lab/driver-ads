import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { getMyAdvertiser, updateMyAdvertiser, createMyAdvertiser } from "@/lib/advertiser";
import { getMyProfile, updateMyAvatar, uploadAvatar } from "@/lib/profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { AvatarUploadField } from "@/components/brand/AvatarUploadField";

export const Route = createFileRoute("/_authenticated/anunciante/perfil")({
  component: AdvertiserProfilePage,
});

interface FormState {
  company_name: string;
  cnpj: string;
  responsible: string;
  email: string;
  phone: string;
  city: string;
  segment: string;
}

const empty: FormState = {
  company_name: "", cnpj: "", responsible: "", email: "", phone: "", city: "", segment: "",
};

function AdvertiserProfilePage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);

  const { data: advertiser, isLoading } = useQuery({
    queryKey: ["my-advertiser", user?.id],
    queryFn: () => getMyAdvertiser(user!.id),
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: () => getMyProfile(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (advertiser) {
      setForm({
        company_name: advertiser.company_name ?? "",
        cnpj: advertiser.cnpj ?? "",
        responsible: advertiser.responsible ?? "",
        email: advertiser.email ?? "",
        phone: advertiser.phone ?? "",
        city: advertiser.city ?? "",
        segment: advertiser.segment ?? "",
      });
    } else if (user) {
      setForm((f) => ({ ...f, email: user.email ?? "" }));
    }
  }, [advertiser, user]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessao expirada");
      const payload = {
        company_name: form.company_name,
        cnpj: form.cnpj,
        responsible: form.responsible,
        email: form.email,
        phone: form.phone,
        city: form.city,
        segment: form.segment || null,
      };
      if (advertiser) {
        return updateMyAdvertiser(advertiser.id, payload);
      }
      return createMyAdvertiser({ ...payload, user_id: user.id });
    },
    onSuccess: () => {
      toast.success(advertiser ? "Dados atualizados com sucesso" : "Cadastro enviado para analise");
      qc.invalidateQueries({ queryKey: ["my-advertiser"] });
      navigate({ to: "/anunciante" });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar"),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Sessao expirada");
      const avatarUrl = await uploadAvatar(user.id, file);
      await updateMyAvatar(user.id, avatarUrl);
      return avatarUrl;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    },
  });

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/anunciante"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Dados da empresa</CardTitle>
              <CardDescription>Mantenha seus dados sempre atualizados.</CardDescription>
            </div>
            {advertiser && <StatusBadge status={advertiser.status} />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <AvatarUploadField
              currentUrl={profile?.avatar_url}
              fallback={form.company_name || user?.email || "Anunciante"}
              label="Logo ou foto do perfil"
              onUpload={(file) => avatarMutation.mutateAsync(file)}
            />
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          >
            <Field id="company_name" label="Razao social / Nome da empresa" value={form.company_name} onChange={(v) => set("company_name", v)} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cnpj" label="CNPJ" value={form.cnpj} onChange={(v) => set("cnpj", v)} required />
              <Field id="city" label="Cidade" value={form.city} onChange={(v) => set("city", v)} required />
            </div>
            <Field id="responsible" label="Responsavel" value={form.responsible} onChange={(v) => set("responsible", v)} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="email" type="email" label="E-mail" value={form.email} onChange={(v) => set("email", v)} required />
              <Field id="phone" label="Telefone / WhatsApp" value={form.phone} onChange={(v) => set("phone", v)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segment">Segmento</Label>
              <Textarea id="segment" value={form.segment} onChange={(e) => set("segment", e.target.value)}
                placeholder="Ex.: Imobiliaria, Restaurante, Clinica..." rows={2} />
            </div>
            <Button type="submit" variant="hero" disabled={mutation.isPending} className="w-full sm:w-auto">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alteracoes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ id, label, value, onChange, type = "text", required }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}
