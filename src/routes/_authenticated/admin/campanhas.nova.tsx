import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Upload } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { listAdvertisers } from "@/lib/admin";
import { createCampaignAdmin } from "@/lib/campaigns-admin";
import { uploadCampaignArt, updateMyCampaign } from "@/lib/campaigns";
import { formatPlanPrice, listActiveCampaignPlans } from "@/lib/campaign-plans";
import { upsertCampaignQrCode, type QrDestinationType } from "@/lib/trackable-qr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/campanhas/nova")({
  component: NewAdminCampaignPage,
});

interface FormState {
  advertiser_id: string;
  name: string;
  description: string;
  city: string;
  regions: string;
  vehicles_qty: string;
  period_start: string;
  period_end: string;
  plan_id: string;
  qr_destination_type: QrDestinationType;
  qr_whatsapp_phone: string;
  qr_landing_page_url: string;
  observations: string;
}

const empty: FormState = {
  advertiser_id: "",
  name: "",
  description: "",
  city: "",
  regions: "",
  vehicles_qty: "1",
  period_start: "",
  period_end: "",
  plan_id: "",
  qr_destination_type: "whatsapp",
  qr_whatsapp_phone: "",
  qr_landing_page_url: "",
  observations: "",
};

function NewAdminCampaignPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [art, setArt] = useState<File | null>(null);

  const { data: advertisers = [], isLoading: loadingAdvertisers } = useQuery({
    queryKey: ["admin", "advertisers", "campaign-create"],
    queryFn: () => listAdvertisers(),
  });

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ["active-campaign-plans"],
    queryFn: listActiveCampaignPlans,
  });

  useEffect(() => {
    if (!form.plan_id && plans[0]?.id) {
      setForm((current) => ({ ...current, plan_id: plans[0].id }));
    }
  }, [form.plan_id, plans]);

  const selectedAdvertiser = useMemo(
    () => advertisers.find((advertiser) => advertiser.id === form.advertiser_id) ?? null,
    [advertisers, form.advertiser_id],
  );

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === form.plan_id) ?? null,
    [form.plan_id, plans],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!selectedAdvertiser) throw new Error("Selecione o anunciante da campanha.");
      if (!selectedPlan) throw new Error("Selecione um plano para a campanha.");

      const regions = form.regions
        .split(",")
        .map((region) => region.trim())
        .filter(Boolean);

      const created = await createCampaignAdmin({
        advertiser_id: selectedAdvertiser.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        city: form.city.trim(),
        regions,
        vehicles_qty: Number(form.vehicles_qty || 1),
        period_start: form.period_start,
        period_end: form.period_end,
        plan_id: selectedPlan.id,
        plan_value: selectedPlan.monthly_price_cents / 100,
        observations: form.observations.trim() || null,
        status: "pending_review",
      });

      if (art) {
        try {
          const path = await uploadCampaignArt(selectedAdvertiser.id, art);
          await updateMyCampaign(created.id, { art_url: path });
        } catch (error) {
          console.error("Falha ao enviar arte", error);
          toast.warning("Campanha criada, mas a arte nao pode ser enviada. Tente novamente nos detalhes.");
        }
      }

      await upsertCampaignQrCode({
        campaignId: created.id,
        advertiserId: selectedAdvertiser.id,
        destinationType: form.qr_destination_type,
        whatsappPhone: form.qr_whatsapp_phone,
        landingPageUrl: form.qr_landing_page_url,
        createdBy: user?.id ?? null,
      });

      return created;
    },
    onSuccess: (campaign) => {
      toast.success("Campanha criada para o anunciante");
      navigate({ to: "/admin/campanhas/$id", params: { id: campaign.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canSubmit =
    !!selectedAdvertiser &&
    form.name.trim().length > 2 &&
    form.city.trim().length > 1 &&
    form.period_start &&
    form.period_end &&
    Number(form.vehicles_qty) > 0 &&
    !!selectedPlan &&
    new Date(form.period_end) >= new Date(form.period_start) &&
    (form.qr_destination_type === "whatsapp"
      ? form.qr_whatsapp_phone.replace(/\D/g, "").length >= 10
      : form.qr_landing_page_url.trim().length > 4);

  return (
    <div className="max-w-4xl space-y-6">
      <Link
        to="/admin/campanhas"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para campanhas
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Nova campanha</h1>
        <p className="mt-1 text-muted-foreground">
          Cadastre uma campanha diretamente para um anunciante da plataforma.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da campanha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Anunciante *</Label>
            <Select
              value={form.advertiser_id}
              onValueChange={(value) => {
                const advertiser = advertisers.find((item) => item.id === value);
                setForm({
                  ...form,
                  advertiser_id: value,
                  city: form.city || advertiser?.city || "",
                  qr_whatsapp_phone: form.qr_whatsapp_phone || advertiser?.phone || "",
                });
              }}
              disabled={loadingAdvertisers}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingAdvertisers ? "Carregando anunciantes..." : "Selecione"} />
              </SelectTrigger>
              <SelectContent>
                {advertisers.map((advertiser) => (
                  <SelectItem key={advertiser.id} value={advertiser.id}>
                    {advertiser.company_name} - {advertiser.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAdvertiser && (
              <p className="text-xs text-muted-foreground">
                Responsavel: {selectedAdvertiser.responsible} - {selectedAdvertiser.email}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome da campanha *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ex.: Novo Oculos - Florianopolis"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descricao</Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Objetivo, chamada ou contexto da campanha."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade *</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                placeholder="Ex.: Florianopolis"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regions">Regioes</Label>
              <Input
                id="regions"
                value={form.regions}
                onChange={(event) => setForm({ ...form, regions: event.target.value })}
                placeholder="Ex.: Centro, Norte da Ilha"
              />
              <p className="text-xs text-muted-foreground">Separe por virgula.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="vehicles_qty">Qtd. veiculos *</Label>
              <Input
                id="vehicles_qty"
                type="number"
                min={1}
                step={1}
                value={form.vehicles_qty}
                onChange={(event) => setForm({ ...form, vehicles_qty: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_start">Inicio *</Label>
              <Input
                id="period_start"
                type="date"
                value={form.period_start}
                onChange={(event) => setForm({ ...form, period_start: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">Termino *</Label>
              <Input
                id="period_end"
                type="date"
                value={form.period_end}
                onChange={(event) => setForm({ ...form, period_end: event.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Plano da campanha *</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                O valor da campanha sera derivado do plano selecionado.
              </p>
            </div>
            {loadingPlans ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">Carregando planos...</div>
            ) : plans.length === 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                Nenhum plano ativo esta disponivel.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((plan) => {
                  const active = form.plan_id === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setForm({ ...form, plan_id: plan.id })}
                      className={[
                        "rounded-lg border p-4 text-left transition",
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-primary/60",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{plan.name}</p>
                          {plan.description && (
                            <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                          )}
                        </div>
                        {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <p className="font-display text-2xl font-bold">{formatPlanPrice(plan)}</p>
                        <p className="text-xs text-muted-foreground">/ mes</p>
                      </div>
                      {plan.driver_payout_cents > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Repasse ao motorista:{" "}
                          {(plan.driver_payout_cents / 100).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: plan.currency || "BRL",
                          })}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="art">Arte da campanha</Label>
            <div className="flex items-center gap-3">
              <Input
                id="art"
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) => setArt(event.target.files?.[0] ?? null)}
              />
              {art && <Upload className="h-4 w-4 text-success" />}
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-semibold">QR Code rastreavel</p>
              <p className="text-xs text-muted-foreground">
                Configure o destino do QR que sera usado na arte final.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Destino do QR *</Label>
                <Select
                  value={form.qr_destination_type}
                  onValueChange={(value) =>
                    setForm({ ...form, qr_destination_type: value as QrDestinationType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="landing_page">Landing page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.qr_destination_type === "whatsapp" ? (
                <div className="space-y-2">
                  <Label htmlFor="qr_whatsapp_phone">WhatsApp *</Label>
                  <Input
                    id="qr_whatsapp_phone"
                    value={form.qr_whatsapp_phone}
                    onChange={(event) => setForm({ ...form, qr_whatsapp_phone: event.target.value })}
                    placeholder="Ex.: 48999999999"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="qr_landing_page_url">URL da landing page *</Label>
                  <Input
                    id="qr_landing_page_url"
                    value={form.qr_landing_page_url}
                    onChange={(event) => setForm({ ...form, qr_landing_page_url: event.target.value })}
                    placeholder="https://empresa.com/promocao"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">Observacoes</Label>
            <Textarea
              id="observations"
              rows={3}
              value={form.observations}
              onChange={(event) => setForm({ ...form, observations: event.target.value })}
              placeholder="Informacoes adicionais para o time."
            />
          </div>

          <div className="flex justify-end gap-3 border-t pt-2">
            <Button variant="ghost" asChild>
              <Link to="/admin/campanhas">Cancelar</Link>
            </Button>
            <Button variant="hero" disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar campanha
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
