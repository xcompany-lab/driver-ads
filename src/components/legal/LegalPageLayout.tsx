import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, LogIn, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

export interface LegalSection {
  id: string;
  title: string;
  icon: LucideIcon;
  content: ReactNode;
}

interface LegalPageLayoutProps {
  title: string;
  icon: LucideIcon;
  lastUpdated: string;
  sections: LegalSection[];
}

export default function LegalPageLayout({ title, icon: HeroIcon, lastUpdated, sections }: LegalPageLayoutProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/"><Logo size={32} showWordmark={false} /></Link>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Link>
            </Button>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login"><LogIn className="h-4 w-4 mr-1" /> Entrar</Link>
          </Button>
        </div>
      </nav>

      <section className="pt-32 pb-12 text-center px-4">
        <div className="flex justify-center mb-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand shadow-brand">
            <HeroIcon className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gradient-brand mb-3">{title}</h1>
        <p className="text-sm text-muted-foreground font-mono">Última atualização: {lastUpdated}</p>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 flex gap-10">
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">Índice</p>
            <nav className="flex flex-col gap-1">
              {sections.map((s, i) => {
                const Icon = s.icon;
                const active = activeId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={cn(
                      "flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{`${i + 1}. ${s.title}`}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0 space-y-12">
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{i + 1}. {s.title}</h2>
                </div>
                <div className="text-muted-foreground leading-relaxed space-y-3 pl-11">{s.content}</div>
              </section>
            );
          })}
        </main>
      </div>

      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-3 text-center">
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <Link to="/termos" className="text-muted-foreground hover:text-foreground transition-colors">Termos de Uso</Link>
            <span className="text-border">•</span>
            <Link to="/privacidade" className="text-muted-foreground hover:text-foreground transition-colors">Política de Privacidade</Link>
            <span className="text-border">•</span>
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Início</Link>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            © {new Date().getFullYear()} Driver Ads — Sua mídia em movimento.
          </p>
        </div>
      </footer>
    </div>
  );
}
