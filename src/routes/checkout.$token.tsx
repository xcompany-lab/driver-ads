import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { CheckCircle2, Copy, CreditCard, Loader2, QrCode, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { PagouCardElement, type PagouTokenData } from "@/components/checkout/PagouCardElement";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/checkout/$token")({
  head: () => ({
    links: [
      { rel: "preconnect", href: "https://js.pagou.ai" },
      { rel: "dns-prefetch", href: "https://js.pagou.ai" },
    ],
  }),
  component: PublicCheckoutPage,
});

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FAILED_CARD_STATUSES = [
  "refused",
  "failed",
  "declined",
  "denied",
  "not_authorized",
  "error",
  "canceled",
  "cancelled",
  "voided",
  "chargedback",
  "blocked",
];

interface PublicCheckoutState {
  public_key: string;
  environment: "sandbox" | "production";
  campaign: {
    id: string;
    name: string;
    city: string;
    billing_status?: string | null;
    status?: string | null;
    vehicles_qty?: number | null;
  };
  advertiser: { company_name?: string | null };
  plan: { id: string; name: string; monthly_price_cents: number; currency?: string | null };
  vehicles_qty: number;
  total_cents: number;
  pix_transaction: PublicPixTx | null;
  card_transaction: {
    id: string;
    status: string;
    amount_cents?: number | null;
    paid_at?: string | null;
  } | null;
}

interface PublicPixTx {
  id?: string;
  transaction_id?: string;
  pagou_transaction_id?: string | null;
  status: string;
  amount_cents?: number | null;
  pix_qr_code: string | null;
  pix_qr_code_image: string | null;
  expires_at: string | null;
  paid_at?: string | null;
}

async function invokePublicCheckout<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("pagou-public-checkout", { body });
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
      return String(payload.error ?? payload.message ?? fallback);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function PublicCheckoutPage() {
  const { token } = Route.useParams();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["public-checkout", token],
    queryFn: () => invokePublicCheckout<PublicCheckoutState>({ action: "state", checkout_token: token }),
    refetchInterval: (query) => {
      const state = query.state.data as PublicCheckoutState | undefined;
      const billingStatus = state?.campaign?.billing_status;
      if (billingStatus === "active" || billingStatus === "trialing" || billingStatus === "paid") return false;
      return 4000;
    },
  });

  const confirmed =
    data?.campaign.billing_status === "active" ||
    data?.campaign.billing_status === "trialing" ||
    data?.campaign.billing_status === "paid";
  const cardStatus = String(data?.card_transaction?.status ?? "").toLowerCase();
  const cardFailed =
    data?.campaign.billing_status === "payment_failed" || FAILED_CARD_STATUSES.includes(cardStatus);
  const cardPending =
    !cardFailed && !!data?.card_transaction && data?.campaign.billing_status === "pending";

  const cardPay = async (tokenData: PagouTokenData) => {
    try {
      const transaction = await invokePublicCheckout<{
        transaction_id: string;
        pagou_transaction_id?: string;
        status: string;
        next_action?: unknown;
      }>({
        action: "card",
        checkout_token: token,
        card_token: tokenData.token,
        card_brand: tokenData.brand ?? null,
        card_last4: tokenData.last4 ?? null,
        exp_month: tokenData.exp_month ?? null,
        exp_year: tokenData.exp_year ?? null,
      });
      const txStatus = String(transaction.status ?? "").toLowerCase();
      if (FAILED_CARD_STATUSES.includes(txStatus)) {
        toast.error("Pagamento recusado", {
          description: "Confira os dados do cartao ou tente outro cartao.",
        });
      } else {
        toast.message("Pagamento em processamento", {
          description: "A campanha sera liberada apos a confirmacao da Pagou.ai.",
        });
      }
      refetch();
      return transaction;
    } catch (error) {
      toast.error("Erro ao criar pagamento", { description: (error as Error).message });
      throw error;
    }
  };

  if (isLoading) {
    return (
      <PublicCheckoutShell>
        <div className="mx-auto max-w-5xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </PublicCheckoutShell>
    );
  }

  if (!data) {
    return (
      <PublicCheckoutShell>
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Link indisponivel</CardTitle>
              <CardDescription>Este checkout nao foi encontrado ou expirou.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </PublicCheckoutShell>
    );
  }

  return (
    <PublicCheckoutShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">Driver Ads</p>
          <h1 className="text-3xl font-bold tracking-tight">Pagamento da campanha</h1>
          <p className="mt-1 text-muted-foreground">
            {data.campaign.name} · {data.campaign.city}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Forma de pagamento</CardTitle>
              <CardDescription>Escolha cartao recorrente ou Pix mensal.</CardDescription>
            </CardHeader>
            <CardContent>
              {confirmed ? (
                <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium text-success">Pagamento confirmado</p>
                    <p className="text-sm text-muted-foreground">
                      A Driver Ads ja recebeu a confirmacao financeira desta campanha.
                    </p>
                  </div>
                </div>
              ) : (
                <Tabs defaultValue={data.pix_transaction ? "pix" : "card"} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="card">
                      <CreditCard className="mr-2 h-4 w-4" /> Cartao
                    </TabsTrigger>
                    <TabsTrigger value="pix">
                      <QrCode className="mr-2 h-4 w-4" /> Pix
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="card" className="space-y-3 pt-4">
                    {cardFailed && (
                      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                        <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
                        <div className="text-sm">
                          <p className="font-medium text-destructive">Pagamento recusado</p>
                          <p className="text-muted-foreground">Confira os dados ou tente outro cartao.</p>
                        </div>
                      </div>
                    )}
                    {cardPending ? (
                      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <div className="text-sm">
                          <p className="font-medium">Aguardando confirmacao da Pagou.ai...</p>
                          <p className="text-muted-foreground">A liberacao depende do webhook de pagamento.</p>
                        </div>
                      </div>
                    ) : (
                      <PagouCardElement
                        publicKey={data.public_key}
                        environment={data.environment}
                        buttonLabel={`Pagar ${brl(data.total_cents)} / mes`}
                        onTokenize={cardPay}
                      />
                    )}
                  </TabsContent>
                  <TabsContent value="pix" className="pt-4">
                    <PublicPixCheckout token={token} state={data} onChanged={refetch} />
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
                <span className="text-muted-foreground">Anunciante</span>
                <span className="font-medium">{data.advertiser.company_name ?? "Cliente"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plano</span>
                <span className="font-medium">{data.plan.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Veiculos</span>
                <span className="font-medium">
                  {data.vehicles_qty} x {brl(data.plan.monthly_price_cents)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor mensal</span>
                <span className="font-semibold">{brl(data.total_cents)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status financeiro</span>
                <StatusBadge status={data.campaign.billing_status ?? "none"} />
              </div>
              <p className="pt-2 text-xs text-muted-foreground">
                Pagamento processado pela Pagou.ai. A campanha fisica entra em circulacao apos confirmacao
                financeira e aprovacao operacional.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicCheckoutShell>
  );
}

function PublicCheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[linear-gradient(rgba(37,99,235,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.08)_1px,transparent_1px)] bg-[size:64px_64px] bg-background px-4 py-8 text-foreground">
      {children}
    </main>
  );
}

function PublicPixCheckout({
  token,
  state,
  onChanged,
}: {
  token: string;
  state: PublicCheckoutState;
  onChanged: () => void;
}) {
  const [localPix, setLocalPix] = useState<PublicPixTx | null>(null);
  const tx = localPix ?? state.pix_transaction;
  const isPaid = tx?.status === "paid" || !!tx?.paid_at;
  const [generatedQr, setGeneratedQr] = useState<string | null>(null);

  useEffect(() => {
    if (tx?.pix_qr_code_image || !tx?.pix_qr_code) {
      setGeneratedQr(null);
      return;
    }
    let active = true;
    QRCode.toDataURL(tx.pix_qr_code, { errorCorrectionLevel: "M", margin: 1, width: 320 })
      .then((url) => active && setGeneratedQr(url))
      .catch(() => active && setGeneratedQr(null));
    return () => {
      active = false;
    };
  }, [tx?.pix_qr_code, tx?.pix_qr_code_image]);

  const qrSrc = tx?.pix_qr_code_image
    ? tx.pix_qr_code_image.startsWith("data:")
      ? tx.pix_qr_code_image
      : `data:image/png;base64,${tx.pix_qr_code_image}`
    : generatedQr;

  const create = useMutation({
    mutationFn: () => invokePublicCheckout<PublicPixTx>({ action: "pix", checkout_token: token }),
    onSuccess: (pix) => {
      setLocalPix(pix);
      onChanged();
    },
    onError: (error: Error) => toast.error("Erro ao gerar Pix", { description: error.message }),
  });

  const copy = async () => {
    if (!tx?.pix_qr_code) return;
    try {
      await navigator.clipboard.writeText(tx.pix_qr_code);
      toast.success("Codigo Pix copiado");
    } catch {
      toast.error("Nao foi possivel copiar");
    }
  };

  if (isPaid) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
        <div>
          <p className="font-medium text-success">Pagamento confirmado</p>
          <p className="text-sm text-muted-foreground">A campanha foi liberada para o periodo pago.</p>
        </div>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Pague <strong>{brl(state.total_cents)}</strong> agora via Pix e libere o periodo de 30 dias.
        </p>
        <Button onClick={() => create.mutate()} disabled={create.isPending} size="lg">
          {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <QrCode className="mr-2 h-4 w-4" />
          Gerar QR Code Pix
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4 text-center">
        {qrSrc ? (
          <img src={qrSrc} alt="QR Code Pix" className="mx-auto h-56 w-56 rounded bg-white p-2" />
        ) : (
          <div className="mx-auto flex h-56 w-56 items-center justify-center rounded bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Valor: <strong className="text-foreground">{brl(tx.amount_cents ?? state.total_cents)}</strong>
          {tx.expires_at && <> · expira em {new Date(tx.expires_at).toLocaleString("pt-BR")}</>}
        </p>
      </div>
      {tx.pix_qr_code && (
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase text-muted-foreground">Pix Copia e Cola</label>
          <div className="flex gap-2">
            <textarea readOnly value={tx.pix_qr_code} className="flex-1 rounded-md border bg-background p-2 text-xs font-mono" rows={3} />
            <Button variant="outline" size="icon" onClick={copy} aria-label="Copiar">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Aguardando confirmacao do pagamento...
      </div>
    </div>
  );
}
