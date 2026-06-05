import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Pagou?: {
      setEnvironment: (env: "sandbox" | "production") => void;
      elements: (opts: { publicKey: string; locale?: string; origin?: string }) => PagouElements;
    };
  }
}

interface PagouCardElement {
  mount: (selector: string) => void;
  unmount: () => void;
  on: (evt: string, cb: (e: unknown) => void) => void;
}
interface PagouElements {
  create: (
    type: "card",
    opts?: { theme?: "night" | "day"; locale?: string },
  ) => PagouCardElement;
  submit: (opts: {
    mode: "subscription" | "payment";
    createTransaction: (tokenData: PagouTokenData) => Promise<unknown>;
  }) => Promise<{ status?: string; error?: { message?: string } }>;
}
export interface PagouTokenData {
  token: string;
  brand?: string;
  last4?: string;
  exp_month?: string;
  exp_year?: string;
}

interface Props {
  publicKey: string;
  environment: "sandbox" | "production";
  disabled?: boolean;
  buttonLabel?: string;
  onTokenize: (data: PagouTokenData) => Promise<void>;
}

let sdkPromise: Promise<void> | null = null;
function loadPagouSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Pagou) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.pagou.ai/payments/v3.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar o SDK Pagou"));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

export function PagouCardElement({
  publicKey,
  environment,
  disabled,
  buttonLabel = "Assinar agora",
  onTokenize,
}: Props) {
  const mountedRef = useRef(false);
  const elementsRef = useRef<PagouElements | null>(null);
  const cardRef = useRef<PagouCardElement | null>(null);
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mountedRef.current) return;
    if (!publicKey) {
      setError("Chave pública da Pagou não configurada");
      return;
    }
    mountedRef.current = true;

    loadPagouSdk()
      .then(() => {
        if (!window.Pagou) throw new Error("SDK Pagou indisponível");
        window.Pagou.setEnvironment(environment);
        const elements = window.Pagou.elements({
          publicKey,
          locale: "pt-BR",
          origin: window.location.origin,
        });
        elementsRef.current = elements;
        const card = elements.create("card", { theme: "night", locale: "pt-BR" });
        cardRef.current = card;
        card.on("ready", () => {
          console.log("[Pagou] card ready");
          setReady(true);
        });
        card.on("change", (evt: unknown) => {
          const e = evt as { complete?: boolean; error?: { message?: string } };
          console.log("[Pagou] card change", e);
          setValid(!!e.complete);
          setError(e.error?.message ?? null);
        });
        card.mount("#pagou-card-element");
      })
      .catch((e) => setError((e as Error).message));

    return () => {
      try {
        cardRef.current?.unmount();
      } catch {
        /* noop */
      }
    };
  }, [publicKey, environment]);

  async function handleSubmit() {
    if (!elementsRef.current || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await elementsRef.current.submit({
        mode: "subscription",
        createTransaction: async (tokenData) => {
          await onTokenize(tokenData);
          // Return provisional payload — Pagou SDK expects an object
          return { status: "processing" };
        },
      });
      if (result?.error?.message) setError(result.error.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        id="pagou-card-element"
        className="min-h-[200px] rounded-lg border border-border bg-card p-4"
      />
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={disabled || !ready || submitting}
        onClick={handleSubmit}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando…
          </>
        ) : (
          buttonLabel
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        Cobrança via Pagou.ai. Os dados do cartão são tokenizados no navegador — a
        Driver Ads nunca recebe o número do cartão.
      </p>
    </div>
  );
}
