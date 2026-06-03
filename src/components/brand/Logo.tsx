import logoAsset from "@/assets/driver-ads-logo-icon.png.asset.json";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
  variant?: "default" | "light";
}

export function Logo({ className, size = 40, showWordmark = true, variant = "default" }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        src={logoAsset.url}
        alt="Driver Ads"
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="rounded-xl shadow-elevated"
        style={{ width: size, height: size }}
      />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display font-extrabold tracking-tight text-xl",
              variant === "light" ? "text-white" : "text-foreground",
            )}
          >
            DRIVER <span className="text-gradient-brand">ADS</span>
          </span>
          <span
            className={cn(
              "text-[10px] font-medium tracking-[0.2em] mt-0.5",
              variant === "light" ? "text-white/70" : "text-muted-foreground",
            )}
          >
            SUA MÍDIA EM MOVIMENTO
          </span>
        </div>
      )}
    </div>
  );
}
