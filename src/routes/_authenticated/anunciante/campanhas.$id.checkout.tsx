import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, CheckCircle2, CreditCard, QrCode } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { PagouCardElement } from "@/components/checkout/PagouCardElement";
import { PixCheckout } from "@/components/checkout/PixCheckout";

export const Route = createFileRoute(
  "/_authenticated/anunciante/campanhas/$id/checkout",
)({
  head: () => ({
    links: [
      { rel: "preconnect", href: "https://js.pagou.ai" },
      { rel: "preconnect", href: "https://api.pagou.ai" },
      { rel: "preconnect", href: "https://api-sandbox.pagou.ai" },
      { rel: "dns-prefetch", href: "https://js.pagou.ai" },
    ],
  }),
  component: CheckoutPage,
});

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function invokeFn<T>(name: string, body?: unknown): Promise<T> {
  const opts = body !== undefined ? { body: body as Record<string, unknown> } : {};
  const { data, error } = await supabase.functions.invoke(name, opts);
  if (error) throw new Error(await extractFunctionError(error));
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

async function extractFunctionError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "Falha na Edge Function";
  const context = (error as { context?: unknown }).context;

  if (context instanceof Response) {
    try {
      const payload = (await context.clone().json()) as Record<string, unknown>;
      return formatFunctionError(payload, fallback);
    } catch {
      return fallback;
    }
  }

  if (context && typeof context === "object") {
    return formatFunctionError(context as Record<string, unknown>, fallback);
  }

  return fallback;
}

function formatFunctionError(payload: Record<string, unknown>, fallback: string) {
  const message =
    stringOrNull(payload.error) ??
    stringOrNull(payload.detail) ??
    stringOrNull(payload.message) ??
    fallback;
  const requestId = stringOrNull(payload.pagou_request_id) ?? stringOrNull(payload.request_id);
  const status = typeof payload.status === "number" ? `HTTP ${payload.status}` : null;
  const suffix = [status, requestId ? `request ${requestId}` : null].filter(Boolean).join(" · ");
  return suffix ? `${message} (${suffix})` : message;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function CheckoutPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  // Public key
  const { data: keyData, isLoading: loadingKey } = useQuery({
    queryKey: ["pagou-public-key"],
    queryFn: () =>
      invokeFn<{ public_key: string; environment: "sandbox" | "production" }>(
        "pagou-public-key",
      ),
    staleTime: 5 * 60_000,
  });

  // Campaign + plan (via Supabase RLS — advertiser sees only own)
  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ["checkout-campaign", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select(
          "id, name, city, period_start, period_end, billing_status, status, plan_id, plan:campaign_plans(id, name, monthly_price_cents, currency)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Default plan if campaign has none yet
  const { data: defaultPlan } = useQuery({
    queryKey: ["pagou-default-plan"],
    enabled: !campaign?.plan_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_plans")
        .select("id, name, monthly_price_cents, currency")
        .eq("is_active", true)
        .order("monthly_price_cents", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const plan = campaign?.plan ?? defaultPlan;

  // Poll billing state after submit
  const { data: billing, refetch: refetchBilling } = useQuery({
    queryKey: ["checkout-billing-state", id],
    queryFn: () =>
      invokeFn<{
        campaign: { billing_status?: string; operational_status?: string } | null;
        subscription: { id: string; status: string; card_brand?: string; card_last4?: string } | null;
        pix_transaction: {
          id: string;
          pagou_transaction_id?: string | null;
          status: string;
          amount_cents?: number | null;
          pix_qr_code: string | null;
          pix_qr_code_image: string | null;
          expires_at: string | null;
          paid_at?: string | null;
        } | null;
      }>("pagou-billing-state", { campaign_id: id }),
    refetchInterval: (q) => {
      const state = q.state.data as { campaign?: { billing_status?: string } } | undefined;
      const status = state?.campaign?.billing_status;
      if (status === "active" || status === "trialing" || status === "paid") return false;
      return 4000;
    },
    enabled: !!campaign,
  });

  const confirmedActive =
    billing?.campaign?.billing_status === "active" ||
    billing?.campaign?.billing_status === "trialing" ||
    billing?.campaign?.billing_status === "paid";

  useEffect(() => {
    if (confirmedActive) {
      toast.success("Assinatura confirmada!");
    }
  }, [confirmedActive]);

  if (loadingCampaign || loadingKey) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-muted-foreground">Campanha não encontrada.</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/anunciante/campanhas/$id" params={{ id }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Plano não configurado</CardTitle>
            <CardDescription>
              Nenhum plano comercial está disponível no momento. Entre em contato com o
              suporte para liberar a contratação.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleTokenize = async (tokenData: {
    token: string;
    brand?: string;
    last4?: string;
    exp_month?: string;
    exp_year?: string;
  }) => {
    try {
      await invokeFn<{ subscription_id: string; status: string }>(
        "pagou-create-subscription",
        {
          campaign_id: id,
          plan_id: plan.id,
          token: tokenData.token,
          card_brand: tokenData.brand ?? null,
          card_last4: tokenData.last4 ?? null,
          exp_month: tokenData.exp_month ?? null,
          exp_year: tokenData.exp_year ?? null,
        },
      );
      toast.message("Pagamento em processamento", {
        description: "A campanha será ativada após a confirmação da Pagou.ai.",
      });
      refetchBilling();
    } catch (e) {
      toast.error("Erro ao criar assinatura", { description: (e as Error).message });
      throw e;
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/anunciante/campanhas/$id" params={{ id }}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para campanha
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contratar assinatura</h1>
        <p className="mt-1 text-muted-foreground">
          {campaign.name} · {campaign.city}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Forma de pagamento</CardTitle>
            <CardDescription>
              Escolha entre cobrança recorrente no cartão ou Pix mensal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {confirmedActive ? (
              <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                <div>
                  <p className="font-medium text-success">Pagamento confirmado</p>
                  <p className="text-sm text-muted-foreground">
                    A campanha está pronta para entrar em circulação.
                  </p>
                  <Button
                    className="mt-3"
                    onClick={() => navigate({ to: "/anunciante/campanhas/$id", params: { id } })}
                  >
                    Voltar à campanha
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs defaultValue={billing?.pix_transaction ? "pix" : "card"} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="card">
                    <CreditCard className="mr-2 h-4 w-4" /> Cartão (recorrente)
                  </TabsTrigger>
                  <TabsTrigger value="pix">
                    <QrCode className="mr-2 h-4 w-4" /> Pix (mensal)
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="card" className="pt-4">
                  {billing?.subscription && billing.campaign?.billing_status === "pending" ? (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <div className="text-sm">
                        <p className="font-medium">Aguardando confirmação da Pagou.ai…</p>
                        <p className="text-muted-foreground">
                          A ativação depende da confirmação do pagamento por webhook.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <PagouCardElement
                      publicKey={keyData?.public_key ?? ""}
                      environment={(keyData?.environment ?? "sandbox") as "sandbox" | "production"}
                      buttonLabel={`Assinar ${brl(plan.monthly_price_cents)} / mês`}
                      onTokenize={handleTokenize}
                    />
                  )}
                </TabsContent>

                <TabsContent value="pix" className="pt-4">
                  <PixCheckout
                    campaignId={id}
                    planId={plan.id}
                    amountCents={plan.monthly_price_cents}
                    existingPix={billing?.pix_transaction ?? null}
                  />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plano</span>
              <span className="font-medium">{plan.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Valor mensal</span>
              <span className="font-semibold">{brl(plan.monthly_price_cents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cobrança</span>
              <span>Recorrente, mensal</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status financeiro</span>
              <StatusBadge status={billing?.campaign?.billing_status ?? campaign.billing_status ?? "none"} />
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              Ao confirmar você autoriza a cobrança mensal recorrente no cartão informado, com
              cancelamento livre a qualquer momento. A campanha física só entra em circulação
              após confirmação do pagamento e aprovação operacional.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
