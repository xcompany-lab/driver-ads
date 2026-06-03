import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { createMyDriver, getMyDriver, updateMyDriver } from "@/lib/driver";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/brand/StatusBadge";

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
  pix_key_type: string;
  pix_key: string;
}

const empty: FormState = {
  full_name: "", cpf: "", birth_date: "", email: "", phone: "",
  city: "", pix_key_type: "cpf", pix_key: "",
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

  useEffect(() => {
    if (driver) {
      setForm({
        full_name: driver.full_name ?? "",
        cpf: driver.cpf ?? "",
        birth_date: driver.birth_date ?? "",
        email: driver.email ?? "",
        phone: driver.phone ?? "",
        city: driver.city ?? "",
        pix_key_type: driver.pix_key_type ?? "cpf",
        pix_key: driver.pix_key ?? "",
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
        pix_key_type: form.pix_key_type,
        pix_key: form.pix_key,
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
      toast.success(driver ? "Dados atualizados" : "Cadastro enviado para análise");
      qc.invalidateQueries({ queryKey: ["my-driver"] });
      navigate({ to: "/motorista" });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar"),
  });

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

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
                  : "Estes dados são necessários para a análise do seu cadastro."}
              </CardDescription>
            </div>
            {driver && <StatusBadge status={driver.status} />}
          </div>
        </CardHeader>
        <CardContent>
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
            <Field id="city" label="Cidade de atuação" value={form.city} onChange={(v) => set("city", v)} required />

            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="pix_key_type">Tipo da chave PIX</Label>
                <Select value={form.pix_key_type} onValueChange={(v) => set("pix_key_type", v)}>
                  <SelectTrigger id="pix_key_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field id="pix_key" label="Chave PIX" value={form.pix_key} onChange={(v) => set("pix_key", v)} required />
            </div>

            <Button type="submit" variant="hero" disabled={mutation.isPending} className="w-full sm:w-auto">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {driver ? "Salvar alterações" : "Enviar para análise"}
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
