import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCampaignArtUrl } from "@/lib/campaigns";

interface CampaignArtProps {
  path: string | null | undefined;
  name: string;
  className?: string;
}

/**
 * Pré-visualização da arte da campanha. Resolve a URL assinada do bucket
 * privado `campaign-arts`. Trata PDF mostrando um link para abrir.
 */
export function CampaignArt({ path, name, className }: CampaignArtProps) {
  const [url, setUrl] = useState<string | null>(null);
  const isPdf = Boolean(path?.match(/\.pdf($|\?)/i));

  useEffect(() => {
    let mounted = true;
    if (!path) {
      setUrl(null);
      return;
    }
    getCampaignArtUrl(path).then((signed) => {
      if (mounted) setUrl(signed);
    });
    return () => {
      mounted = false;
    };
  }, [path]);

  const frame = cn("aspect-[16/9] overflow-hidden rounded-lg border bg-muted", className);

  if (!path) {
    return (
      <div className={frame}>
        <div className="grid h-full place-items-center text-muted-foreground">
          <div className="text-center">
            <ImageIcon className="mx-auto h-8 w-8" />
            <p className="mt-1 text-xs">Sem arte enviada</p>
          </div>
        </div>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className={frame}>
        <a
          href={url ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="grid h-full place-items-center text-muted-foreground hover:text-foreground"
        >
          <div className="text-center">
            <FileText className="mx-auto h-8 w-8" />
            <p className="mt-1 text-xs underline">Abrir arte (PDF)</p>
          </div>
        </a>
      </div>
    );
  }

  return (
    <div className={frame}>
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
    </div>
  );
}
