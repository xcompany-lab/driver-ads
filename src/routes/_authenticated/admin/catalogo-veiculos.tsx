import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Star } from "lucide-react";
import {
  listVehicleCatalog,
  upsertVehicleCatalog,
  deleteVehicleCatalog,
  uploadCatalogImage,
  vehicleImageUrl,
  type VehicleModelImage,
} from "@/lib/vehicle-catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/catalogo-veiculos")({
  component: VehicleCatalogAdmin,
});

function VehicleCatalogAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["vehicle-catalog"], queryFn: listVehicleCatalog });

  const del = useMutation({
    mutationFn: (id: string) => deleteVehicleCatalog(id),
    onSuccess: () => {
      toast.success("Modelo removido");
      qc.invalidateQueries({ queryKey: ["vehicle-catalog"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catálogo de veículos</h1>
          <p className="mt-1 text-muted-foreground">
            Vincule figuras a modelos. O sistema casa marcas/modelos cadastrados (mesmo com erros de digitação) à figura mais próxima; sem correspondência, usa a silhueta padrão.
          </p>
        </div>
        <CatalogDialog
          trigger={<Button size="sm"><Plus className="mr-1 h-4 w-4" /> Novo modelo</Button>}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !data?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum modelo no catálogo ainda.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {data.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <Thumb path={entry.image_path} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {entry.is_default ? "Silhueta padrão" : `${entry.display_brand ?? "—"} ${entry.display_model ?? ""}`.trim()}
                    </p>
                    {entry.is_default && <Badge variant="secondary"><Star className="mr-1 h-3 w-3" /> Padrão</Badge>}
                    {entry.tier === "black" && <Badge className="bg-foreground text-background">Black</Badge>}
                    {!entry.active && <Badge variant="outline">Inativo</Badge>}
                  </div>
                  {entry.aliases.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">apelidos: {entry.aliases.join(", ")}</p>
                  )}
                  <p className="text-xs text-muted-foreground">prioridade {entry.priority}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <CatalogDialog
                    entry={entry}
                    trigger={<Button size="sm" variant="outline"><Pencil className="h-4 w-4" /></Button>}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { if (confirm("Remover este modelo do catálogo?")) del.mutate(entry.id); }}
                    disabled={del.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ path }: { path: string }) {
  const url = vehicleImageUrl(path);
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
      {url ? <img src={url} alt="" className="h-full w-full object-contain" /> : null}
    </div>
  );
}

function CatalogDialog({ entry, trigger }: { entry?: VehicleModelImage; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState(entry?.display_brand ?? "");
  const [model, setModel] = useState(entry?.display_model ?? "");
  const [aliases, setAliases] = useState((entry?.aliases ?? []).join(", "));
  const [priority, setPriority] = useState(String(entry?.priority ?? 100));
  const [isDefault, setIsDefault] = useState(entry?.is_default ?? false);
  const [active, setActive] = useState(entry?.active ?? true);
  const [tier, setTier] = useState(entry?.tier ?? "standard");
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      let imagePath = entry?.image_path;
      if (file) imagePath = await uploadCatalogImage(file, brand, model);
      if (!imagePath) throw new Error("Envie uma imagem para o modelo.");
      const aliasArr = aliases
        .split(",")
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean);
      await upsertVehicleCatalog({
        ...(entry?.id ? { id: entry.id } : {}),
        display_brand: brand.trim() || null,
        display_model: model.trim() || null,
        aliases: aliasArr,
        image_path: imagePath,
        is_default: isDefault,
        active,
        tier,
        priority: Number(priority) || 100,
      });
    },
    onSuccess: () => {
      toast.success(entry ? "Modelo atualizado" : "Modelo adicionado");
      qc.invalidateQueries({ queryKey: ["vehicle-catalog"] });
      setOpen(false);
      setFile(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewUrl = file ? URL.createObjectURL(file) : vehicleImageUrl(entry?.image_path);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Editar modelo" : "Novo modelo"}</DialogTitle>
          <DialogDescription>A figura é vinculada por marca + modelo, com casamento tolerante a variações.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
              {previewUrl ? <img src={previewUrl} alt="" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">sem imagem</span>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-file">Imagem (PNG, máx 5MB)</Label>
              <Input id="cat-file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cat-brand">Marca</Label>
              <Input id="cat-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Hyundai" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-model">Modelo</Label>
              <Input id="cat-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="HB20" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cat-aliases">Apelidos (separados por vírgula)</Label>
              <Input id="cat-aliases" value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="hb 20, hb20s, hb20 sense" />
              <p className="text-xs text-muted-foreground">Variações comuns do modelo para ajudar o casamento.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-tier">Categoria</Label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger id="cat-tier"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="black">Black (premium)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Black aparece no plano Driver Ads Black.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cat-priority">Prioridade</Label>
              <Input id="cat-priority" type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="cat-active">Ativo</Label>
              <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="cat-default">Padrão</Label>
              <Switch id="cat-default" checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
