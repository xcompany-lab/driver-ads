import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { createMyDriver, getMyDriver, updateMyDriver } from "@/lib/driver";
import { getMyProfile, updateMyAvatar, uploadAvatar } from "@/lib/profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CitySuggestions, CITY_DATALIST_ID } from "@/components/CitySuggestions";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { DocumentUploadField } from "@/components/brand/DocumentUploadField";
import { AvatarUploadField } from "@/components/brand/AvatarUploadField";
import {
  DRIVER_DOC_LABELS,
  DRIVER_DOC_ORDER,
  DRIVER_DOC_STATUS_KEY,
  uploadDriverDoc,
  updateDriverDoc,
  type DriverDocKey,
  type DriverDocStatusKey,
} from "@/lib/driver-documents";

export const Route = createFileRoute("/_authenticated/motorista/perfil")({
  component: DriverProfilePage,
});

interface FormState {
  full_name: string;
  cpf: string;
  birth_date: string;
  email: string;
  phone: string;
  city: string;
}

const empty: FormState = {
  full_name: "",
  cpf: "",
  birth_date: "",
  email: "",
  phone: "",
  city: "",
};

function DriverProfilePage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);

  const { data: driver, isLoading } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: () => getMyDriver(user!.id),
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: () => getMyProfile(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (driver) {
      setForm({
        full_name: driver.full_name ?? "",
        cpf: driver.cpf ?? "",
        birth_date: driver.birth_date ?? "",
        email: driver.email ?? "",
        phone: driver.phone ?? "",
        city: driver.city ?? "",
      });
    } else if (user) {
      setForm((f) => ({ ...f, email: user.email ?? "" }));
    }
  }, [driver, user]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name,
        cpf: form.cpf,
        birth_date: form.birth_date || null,
        email: form.email,
        phone: form.phone,
        city: form.city,
      };
      if (driver) {
        return updateMyDriver(driver.id, payload);
      }
      return createMyDriver({
        ...payload,
        user_id: user!.id,
        terms_accepted_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success(driver ? "Dados atualizados" : "Cadastro enviado para analise");
      qc.invalidateQueries({ queryKey: ["my-driver"] });
      navigate({ to: "/motorista" });
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

  const driverDocRecord = driver as unknown as Record<DriverDocKey | DriverDocStatusKey, string | null> | undefined;
  const allDriverDocsApproved = Boolean(driver && DRIVER_DOC_ORDER.every((key) => driverDocRecord?.[DRIVER_DOC_STATUS_KEY[key]] === "approved"));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/motorista"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{driver ? "Meu perfil" : "Complete seu cadastro"}</CardTitle>
              <CardDescription>
                {driver
                  ? "Mantenha seus dados sempre atualizados."
                  : "Estes dados sao necessarios para a analise do seu cadastro."}
              </CardDescription>
            </div>
            {driver && <StatusBadge status={driver.status} />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <AvatarUploadField
              currentUrl={profile?.avatar_url}
              fallback={form.full_name || user?.email || "Motorista"}
              label="Foto do motorista"
              onUpload={(file) => avatarMutation.mutateAsync(file)}
            />
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          >
            <Field id="full_name" label="Nome completo" value={form.full_name} onChange={(v) => set("full_name", v)} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cpf" label="CPF" value={form.cpf} onChange={(v) => set("cpf", v)} required />
              <Field id="birth_date" type="date" label="Data de nascimento" value={form.birth_date} onChange={(v) => set("birth_date", v)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="email" type="email" label="E-mail" value={form.email} onChange={(v) => set("email", v)} required />
              <Field id="phone" label="Telefone / WhatsApp" value={form.phone} onChange={(v) => set("phone", v)} required />
            </div>
            <Field id="city" label="Cidade de atuacao" value={form.city} onChange={(v) => set("city", v)} required list={CITY_DATALIST_ID} />
            <CitySuggestions />

            <Button type="submit" variant="hero" disabled={mutation.isPending} className="w-full sm:w-auto">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {driver ? "Salvar alteracoes" : "Enviar para analise"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {driver && (
        <Card>
          <CardHeader>
            <CardTitle>Documentos para auditoria</CardTitle>
            <CardDescription>
              {allDriverDocsApproved
                ? "Seus documentos pessoais ja foram validados pelo nosso time."
                : "Envie os documentos abaixo para validarmos seu cadastro. O perfil so e aprovado apos a verificacao manual do nosso time."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allDriverDocsApproved ? (
              <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-sm">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Documentos aprovados</p>
                  <p className="text-muted-foreground">Nao ha nenhuma acao pendente para seus documentos pessoais.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {DRIVER_DOC_ORDER.map((key) => (
                  <DocumentUploadField
                    key={key}
                    label={DRIVER_DOC_LABELS[key]}
                    currentPath={driverDocRecord?.[key]}
                    status={driverDocRecord?.[DRIVER_DOC_STATUS_KEY[key]] as "pending" | "approved" | "rejected" | null}
                    hideUploadWhenApproved
                    onUpload={async (file) => {
                      const path = await uploadDriverDoc({ userId: user!.id, driverId: driver.id, key, file });
                      await updateDriverDoc(driver.id, key, path);
                      qc.setQueryData(["my-driver", user!.id], (current: typeof driver) => (
                        current ? ({ ...current, [key]: path, [DRIVER_DOC_STATUS_KEY[key]]: "pending" } as typeof current) : current
                      ));
                      await qc.invalidateQueries({ queryKey: ["my-driver", user!.id] });
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ id, label, value, onChange, type = "text", required, list }: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; list?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} list={list} />
    </div>
  );
}
