import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Upload } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { getMyAdvertiser } from "@/lib/advertiser";
import { createMyCampaign, uploadCampaignArt, updateMyCampaign } from "@/lib/campaigns";
import { formatPlanPrice, listActiveCampaignPlans } from "@/lib/campaign-plans";
import { upsertCampaignQrCode, type QrDestinationType } from "@/lib/trackable-qr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CitySuggestions, CITY_DATALIST_ID } from "@/components/CitySuggestions";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/anunciante/campanhas/nova")({
  component: NewCampaignPage,
});

interface FormState {
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

function NewCampaignPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [art, setArt] = useState<File | null>(null);

  const { data: advertiser, isLoading } = useQuery({
    queryKey: ["my-advertiser", user?.id],
    queryFn: () => getMyAdvertiser(user!.id),
    enabled: !!user,
  });

  const { data: plans = [], isLoading: isLoadingPlans } = useQuery({
    queryKey: ["active-campaign-plans"],
    queryFn: listActiveCampaignPlans,
  });

  useEffect(() => {
    if (!form.plan_id && plans[0]?.id) {
      setForm((current) => ({ ...current, plan_id: plans[0].id }));
    }
  }, [form.plan_id, plans]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === form.plan_id) ?? null,
    [form.plan_id, plans],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!advertiser) throw new Error("Cadastro de empresa não encontrado");
      if (!selectedPlan) throw new Error("Selecione um plano para a campanha.");
      const regions = form.regions
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const created = await createMyCampaign({
        advertiser_id: advertiser.id,
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
      });
      if (art) {
        try {
          const path = await uploadCampaignArt(advertiser.id, art);
          await updateMyCampaign(created.id, { art_url: path });
        } catch (e) {
          console.error("Falha ao enviar arte", e);
          toast.warning("Campanha criada, mas a arte não pôde ser enviada. Tente novamente nos detalhes.");
        }
      }
      await upsertCampaignQrCode({
        campaignId: created.id,
        advertiserId: advertiser.id,
        destinationType: form.qr_destination_type,
        whatsappPhone: form.qr_whatsapp_phone,
        landingPageUrl: form.qr_landing_page_url,
        createdBy: user?.id ?? null,
      });
      return created;
    },
    onSuccess: (c) => {
      toast.success("Campanha enviada para análise");
      navigate({ to: "/anunciante/campanhas/$id", params: { id: c.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;

  if (!advertiser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complete seu cadastro</CardTitle>
          <CardDescription>Você precisa cadastrar sua empresa antes de criar campanhas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="hero">
            <Link to="/anunciante/perfil">Cadastrar empresa</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canSubmit =
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
    <div className="space-y-6 max-w-3xl">
      <Link
        to="/anunciante/campanhas"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para campanhas
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Nova campanha</h1>
        <p className="mt-1 text-muted-foreground">
          Preencha os dados abaixo. Sua campanha será enviada para análise da nossa equipe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da campanha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da campanha *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Lançamento Coleção Verão"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Conte rapidamente o objetivo dessa campanha."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade *</Label>
              <Input
                id="city"
                list={CITY_DATALIST_ID}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Ex.: São Paulo"
              />
              <CitySuggestions />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regions">Regiões (opcional)</Label>
              <Input
                id="regions"
                value={form.regions}
                onChange={(e) => setForm({ ...form, regions: e.target.value })}
                placeholder="Ex.: Zona Sul, Centro"
              />
              <p className="text-xs text-muted-foreground">Separe por vírgula.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="vehicles_qty">Qtd. veículos *</Label>
              <Input
                id="vehicles_qty"
                type="number"
                min={1}
                step={1}
                value={form.vehicles_qty}
                onChange={(e) => setForm({ ...form, vehicles_qty: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_start">Início *</Label>
              <Input
                id="period_start"
                type="date"
                value={form.period_start}
                onChange={(e) => setForm({ ...form, period_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">Término *</Label>
              <Input
                id="period_end"
                type="date"
                value={form.period_end}
                onChange={(e) => setForm({ ...form, period_end: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Plano da campanha *</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Escolha o plano comercial que sera usado na cobranca da assinatura.
              </p>
            </div>
            {isLoadingPlans ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">Carregando planos...</div>
            ) : plans.length === 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                Nenhum plano ativo esta disponivel no momento. Entre em contato com a equipe Driver Ads.
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
                          Repasse previsto ao motorista:{" "}
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
            <Label htmlFor="art">Arte da campanha (opcional)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="art"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setArt(e.target.files?.[0] ?? null)}
              />
              {art && <Upload className="h-4 w-4 text-success" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Você poderá enviar ou atualizar a arte depois nos detalhes da campanha.
            </p>
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold">QR Code rastreavel</p>
              <p className="text-xs text-muted-foreground">
                Escolha para onde o QR impresso na arte deve levar quando for escaneado.
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
                    onChange={(e) => setForm({ ...form, qr_whatsapp_phone: e.target.value })}
                    placeholder="Ex.: 48999999999"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="qr_landing_page_url">URL da landing page *</Label>
                  <Input
                    id="qr_landing_page_url"
                    value={form.qr_landing_page_url}
                    onChange={(e) => setForm({ ...form, qr_landing_page_url: e.target.value })}
                    placeholder="https://suaempresa.com/promocao"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              rows={3}
              value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              placeholder="Informações adicionais para nossa equipe."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="ghost" asChild>
              <Link to="/anunciante/campanhas">Cancelar</Link>
            </Button>
            <Button
              variant="hero"
              disabled={!canSubmit || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar para análise
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
