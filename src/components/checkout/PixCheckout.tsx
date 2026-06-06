import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, QrCode, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PixTx {
  transaction_id: string;
  pagou_transaction_id: string;
  pix_qr_code: string | null;
  pix_qr_code_image: string | null;
  expires_at: string | null;
  amount_cents: number;
  status: string;
  paid_at?: string | null;
}

async function invokeFn<T>(name: string, body?: unknown): Promise<T> {
  const opts = body !== undefined ? { body: body as Record<string, unknown> } : {};
  const { data, error } = await supabase.functions.invoke(name, opts);
  if (error) {
    throw new Error(await extractFunctionError(error));
  }
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


const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  campaignId: string;
  planId: string;
  amountCents: number;
  /** transação Pix já existente, se houver (vinda do polling) */
  existingPix?: {
    id: string;
    pagou_transaction_id?: string | null;
    status: string;
    amount_cents?: number | null;
    pix_qr_code: string | null;
    pix_qr_code_image: string | null;
    expires_at: string | null;
    paid_at?: string | null;
  } | null;
}

export function PixCheckout({ campaignId, planId, amountCents, existingPix }: Props) {
  const [localPix, setLocalPix] = useState<PixTx | null>(null);

  const tx: PixTx | null =
    localPix ??
    (existingPix
      ? {
          transaction_id: existingPix.id,
          pagou_transaction_id: existingPix.pagou_transaction_id ?? "",
          pix_qr_code: existingPix.pix_qr_code,
          pix_qr_code_image: existingPix.pix_qr_code_image,
          expires_at: existingPix.expires_at,
          amount_cents: existingPix.amount_cents ?? amountCents,
          status: existingPix.status,
          paid_at: existingPix.paid_at ?? null,
        }
      : null);

  const isPaid = tx?.status === "paid" || !!tx?.paid_at;

  const create = useMutation({
    mutationFn: () =>
      invokeFn<PixTx>("pagou-create-pix", { campaign_id: campaignId, plan_id: planId }),
    onSuccess: (data) => setLocalPix(data),
    onError: (e) => toast.error("Erro ao gerar Pix", { description: (e as Error).message }),
  });

  // Polling enquanto a tx existir e não tiver sido paga
  useQuery({
    queryKey: ["pix-poll", tx?.transaction_id],
    queryFn: async () => {
      const res = await invokeFn<{ pix_transaction: PixTx | null }>(
        "pagou-billing-state",
        { campaign_id: campaignId },
      );
      if (res.pix_transaction) {
        setLocalPix({
          transaction_id: res.pix_transaction.transaction_id ?? "",
          pagou_transaction_id: res.pix_transaction.pagou_transaction_id ?? "",
          pix_qr_code: res.pix_transaction.pix_qr_code,
          pix_qr_code_image: res.pix_transaction.pix_qr_code_image,
          expires_at: res.pix_transaction.expires_at,
          amount_cents: res.pix_transaction.amount_cents ?? amountCents,
          status: res.pix_transaction.status,
          paid_at: res.pix_transaction.paid_at ?? null,
        });
      }
      return res;
    },
    enabled: !!tx && !isPaid,
    refetchInterval: 4000,
  });

  const copy = async () => {
    if (!tx?.pix_qr_code) return;
    try {
      await navigator.clipboard.writeText(tx.pix_qr_code);
      toast.success("Código Pix copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  if (isPaid) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
        <div>
          <p className="font-medium text-success">Pagamento confirmado</p>
          <p className="text-sm text-muted-foreground">
            A campanha foi liberada para o período pago. A próxima cobrança Pix será gerada
            ao fim do ciclo.
          </p>
        </div>
      </div>
    );
  }

  if (!tx) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Pague <strong>{brl(amountCents)}</strong> agora via Pix e libere o período de 30
          dias. Você precisará gerar um novo Pix mensalmente ao fim do ciclo.
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
        {tx.pix_qr_code_image ? (
          <img
            src={
              tx.pix_qr_code_image.startsWith("data:")
                ? tx.pix_qr_code_image
                : `data:image/png;base64,${tx.pix_qr_code_image}`
            }
            alt="QR Code Pix"
            className="mx-auto h-56 w-56 rounded bg-white p-2"
          />
        ) : (
          <div className="mx-auto flex h-56 w-56 items-center justify-center rounded bg-muted">
            <QrCode className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Valor: <strong className="text-foreground">{brl(tx.amount_cents)}</strong>
          {tx.expires_at && (
            <>
              {" · expira em "}
              {new Date(tx.expires_at).toLocaleString("pt-BR")}
            </>
          )}
        </p>
      </div>

      {tx.pix_qr_code && (
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase text-muted-foreground">
            Pix Copia e Cola
          </label>
          <div className="flex gap-2">
            <textarea
              readOnly
              value={tx.pix_qr_code}
              className="flex-1 rounded-md border bg-background p-2 text-xs font-mono"
              rows={3}
            />
            <Button variant="outline" size="icon" onClick={copy} aria-label="Copiar">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Aguardando confirmação do pagamento…
      </div>
    </div>
  );
}
