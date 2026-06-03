import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Car, ClipboardCheck, LayoutDashboard, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Driver Ads — Sua mídia em movimento" },
      {
        name: "description",
        content:
          "Plataforma operacional Driver Ads para gestão de publicidade física em veículos de motoristas e frotas parceiras.",
      },
      { property: "og:title", content: "Driver Ads — Sua mídia em movimento" },
      {
        property: "og:description",
        content:
          "Gestão completa de anunciantes, motoristas, campanhas, instalações e repasses.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Logo variant="light" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="text-white hover:bg-white/10" asChild>
              <Link to="/">Entrar</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/">
                Acessar plataforma <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-night text-white">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,oklch(0.82_0.13_210/_0.4),transparent_45%),radial-gradient(circle_at_80%_60%,oklch(0.60_0.22_258/_0.5),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-6 pt-40 pb-32">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan animate-pulse" />
              Plataforma Operacional
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
              Sua mídia <span className="text-gradient-brand">em movimento</span>.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-white/75 md:text-xl">
              Gerencie anunciantes, motoristas, campanhas, instalações e repasses em um único
              sistema operacional. Controle administrativo claro, sem complexidade desnecessária.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button variant="hero" size="xl" asChild>
                <Link to="/">
                  Sou anunciante <ArrowRight />
                </Link>
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="border-white/30 bg-white/5 text-white hover:bg-white hover:text-brand-night"
                asChild
              >
                <Link to="/">Sou motorista</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Módulos do MVP
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">
              Tudo o que a operação precisa, em um só lugar.
            </h2>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <article
              key={p.title}
              className="group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-elevated"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand">
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-bold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
          <Logo size={32} />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Driver Ads. Plataforma operacional.
          </p>
        </div>
      </footer>
    </div>
  );
}

const PILLARS = [
  {
    icon: LayoutDashboard,
    title: "Painel Administrativo",
    desc: "Controle central da operação com dashboards, status claros e gestão completa.",
  },
  {
    icon: Car,
    title: "Área do Motorista",
    desc: "Mobile-first. Cadastro, campanhas atribuídas, comprovação e ganhos em um só lugar.",
  },
  {
    icon: ClipboardCheck,
    title: "Portal do Anunciante",
    desc: "Solicitação de campanha, acompanhamento de status e comprovantes de instalação.",
  },
  {
    icon: MapPin,
    title: "Vínculo Manual",
    desc: "Atribuição operacional de motoristas a campanhas pela equipe administrativa.",
  },
  {
    icon: Wallet,
    title: "Pagamentos & Repasses",
    desc: "Controle de pagamentos de anunciantes e repasses via PIX para motoristas.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança & LGPD",
    desc: "RLS, perfis separados, fotos protegidas e estrutura compatível com LGPD.",
  },
];
