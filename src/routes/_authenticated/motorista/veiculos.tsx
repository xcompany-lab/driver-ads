import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, Plus, Car } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useSession";
import { createVehicle, getMyDriver, listMyVehicles } from "@/lib/driver";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/motorista/veiculos")({
  component: DriverVehiclesPage,
});

interface VForm {
  plate: string;
  model: string;
  brand: string;
  year: string;
  color: string;
  vehicle_type: string;
}
const emptyV: VForm = { plate: "", model: "", brand: "", year: "", color: "", vehicle_type: "carro" };

function DriverVehiclesPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<VForm>(emptyV);

  const { data: driver } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: () => getMyDriver(user!.id),
    enabled: !!user,
  });

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["my-vehicles", driver?.id],
    queryFn: () => listMyVehicles(driver!.id),
    enabled: !!driver,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!driver) throw new Error("Complete seu cadastro primeiro");
      return createVehicle({
        driver_id: driver.id,
        plate: form.plate.toUpperCase(),
        model: form.model,
        brand: form.brand || null,
        year: form.year ? Number(form.year) : null,
        color: form.color || null,
        vehicle_type: form.vehicle_type,
      });
    },
    onSuccess: () => {
      toast.success("Veículo cadastrado e enviado para análise");
      qc.invalidateQueries({ queryKey: ["my-vehicles"] });
      setForm(emptyV);
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao cadastrar"),
  });

  function set<K extends keyof VForm>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  if (!driver) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Complete seu cadastro</CardTitle>
            <CardDescription>Você precisa cadastrar seus dados pessoais antes de adicionar veículos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="hero"><Link to="/motorista/perfil">Completar cadastro</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/motorista"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus veículos</h1>
          <p className="text-sm text-muted-foreground">Cadastre todos os veículos que você usará nas campanhas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero"><Plus className="mr-2 h-4 w-4" />Adicionar veículo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo veículo</DialogTitle>
              <DialogDescription>Será enviado para análise da equipe.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="plate" label="Placa" value={form.plate} onChange={(v) => set("plate", v)} required />
                <div className="space-y-2">
                  <Label htmlFor="vehicle_type">Tipo</Label>
                  <Select value={form.vehicle_type} onValueChange={(v) => set("vehicle_type", v)}>
                    <SelectTrigger id="vehicle_type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="carro">Carro</SelectItem>
                      <SelectItem value="moto">Moto</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="caminhao">Caminhão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="brand" label="Marca" value={form.brand} onChange={(v) => set("brand", v)} />
                <Field id="model" label="Modelo" value={form.model} onChange={(v) => set("model", v)} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="year" type="number" label="Ano" value={form.year} onChange={(v) => set("year", v)} />
                <Field id="color" label="Cor" value={form.color} onChange={(v) => set("color", v)} />
              </div>
              <DialogFooter>
                <Button type="submit" variant="hero" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cadastrar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !vehicles || vehicles.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Car className="mx-auto mb-3 h-10 w-10 opacity-50" />
            Você ainda não cadastrou nenhum veículo.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {vehicles.map((v) => (
            <Card key={v.id}>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {v.brand ? `${v.brand} ` : ""}{v.model} <span className="font-mono text-sm text-muted-foreground">· {v.plate}</span>
                  </CardTitle>
                  <CardDescription>
                    {[v.vehicle_type, v.year, v.color].filter(Boolean).join(" · ") || "—"}
                  </CardDescription>
                </div>
                <StatusBadge status={v.status} />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
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
