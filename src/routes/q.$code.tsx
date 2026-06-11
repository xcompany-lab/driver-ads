import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/q/$code")({
  component: TrackableQrRedirect,
});

function TrackableQrRedirect() {
  const { code } = Route.useParams();
  const [destinationUrl, setDestinationUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function redirect() {
      const cleanCode = String(code ?? "").trim().toLowerCase();
      if (!/^[a-z0-9]{6,32}$/.test(cleanCode)) {
        setErrorMessage("QR Code invalido.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("track-qr-scan", {
        body: {
          short_code: cleanCode,
          user_agent: navigator.userAgent,
          referrer: document.referrer || null,
          metadata: {
            source: "public_qr_redirect",
            scanned_at_client: new Date().toISOString(),
          },
        },
      });

      if (cancelled) return;

      if (error) {
        console.error("[QR] Failed to track scan", error);
        setErrorMessage("Nao foi possivel registrar o acesso deste QR Code.");
        return;
      }

      const nextUrl =
        data && typeof data === "object" && "destination_url" in data
          ? String((data as { destination_url?: string }).destination_url ?? "")
          : "";
      if (!nextUrl) {
        setErrorMessage("QR Code nao encontrado ou inativo.");
        return;
      }

      setDestinationUrl(nextUrl);
      window.location.replace(nextUrl);
    }

    void redirect();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-100 bg-white shadow-sm">
          {errorMessage ? <QrCode className="h-7 w-7 text-slate-500" /> : <Loader2 className="h-7 w-7 animate-spin text-primary" />}
        </div>

        <h1 className="text-2xl font-bold">
          {errorMessage ? "QR Code indisponivel" : "Redirecionando"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {errorMessage ?? "Estamos registrando o acesso e abrindo o destino da campanha."}
        </p>

        {destinationUrl ? (
          <Button asChild className="mt-6">
            <a href={destinationUrl}>Abrir destino</a>
          </Button>
        ) : null}

        {errorMessage ? (
          <Button asChild variant="outline" className="mt-6">
            <Link to="/">Voltar para Driver Ads</Link>
          </Button>
        ) : null}
      </div>
    </main>
  );
}
