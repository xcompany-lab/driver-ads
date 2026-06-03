import type { ReactNode } from "react";
import bgDesktop from "@/assets/auth-bg-desktop.png.asset.json";
import bgMobile from "@/assets/auth-bg-mobile.png.asset.json";
import logoFull from "@/assets/driver-ads-logo-full.png.asset.json";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="dark min-h-screen w-full bg-[#020617] text-foreground relative overflow-hidden">
      {/* Mobile background */}
      <div
        className="absolute inset-0 lg:hidden bg-cover bg-center"
        style={{ backgroundImage: `url(${bgMobile.url})` }}
        aria-hidden
      />
      <div className="absolute inset-0 lg:hidden bg-gradient-to-b from-[#020617]/30 via-[#020617]/55 to-[#020617]/90" aria-hidden />

      {/* Desktop background */}
      <div
        className="absolute inset-0 hidden lg:block bg-cover bg-center"
        style={{ backgroundImage: `url(${bgDesktop.url})` }}
        aria-hidden
      />
      <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-transparent via-[#020617]/40 to-[#020617]/85" aria-hidden />

      <div className="relative min-h-screen flex flex-col lg:flex-row">
        {/* Brand side (desktop) — bg already has logo, only tagline */}
        <aside className="hidden lg:flex flex-1 flex-col justify-end p-12 xl:p-16">
          <div className="max-w-md border-l-2 border-primary/80 pl-5">
            <h2 className="font-display text-3xl xl:text-4xl font-bold leading-tight text-white">
              Conectamos marcas <br />
              a <span className="text-primary">milhões de pessoas</span> <br />
              todos os dias.
            </h2>
            <p className="mt-4 text-sm text-white/60">
              A plataforma líder em mídia em movimento no interior dos veículos.
            </p>
          </div>
        </aside>

        {/* Form side */}
        <main className="flex-1 flex flex-col items-center justify-center px-5 py-8 lg:py-12 lg:px-12">
          <div className="w-full max-w-md flex flex-col items-center">
            {/* Mobile logo above modal */}
            <img
              src={logoFull.url}
              alt="Driver Ads"
              className="lg:hidden w-[200px] mb-6 drop-shadow-[0_0_24px_rgba(22,120,255,0.4)]"
            />
            <div className="rounded-2xl border border-white/10 bg-[#0a1428]/70 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] p-7 sm:p-9">
              <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-white text-center">
                {title.includes("volta") ? (
                  <>Bem-vindo <span className="text-primary">de volta!</span></>
                ) : (
                  title
                )}
              </h1>
              {subtitle ? (
                <p className="mt-2 text-sm text-white/60 text-center">{subtitle}</p>
              ) : null}
              <div className="mt-7">{children}</div>
            </div>
            {footer ? <div className="mt-6 text-center text-sm text-white/60">{footer}</div> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
