import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso · Driver Ads" },
      { name: "description", content: "Termos de uso da plataforma Driver Ads." },
    ],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link to="/"><Logo size={32} /></Link>
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Início</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Termos de Uso</h1>
        <p className="mt-1 text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">1. Sobre a plataforma</h2>
            <p className="text-muted-foreground">
              A Driver Ads é uma plataforma operacional para gestão de publicidade física em veículos.
              Conecta anunciantes a motoristas habilitados de forma manual e auditada, sem promessas
              automáticas de matching ou métricas de impacto.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">2. Cadastro</h2>
            <p className="text-muted-foreground">
              Para usar a plataforma, anunciantes e motoristas devem fornecer dados verdadeiros,
              completos e atualizados. Cadastros incompletos ou inconsistentes podem ser reprovados
              ou suspensos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">3. Responsabilidades do motorista</h2>
            <p className="text-muted-foreground">
              Manter o veículo em boas condições, conservar a arte aplicada conforme orientação,
              enviar comprovante de instalação verídico e respeitar o período contratado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">4. Responsabilidades do anunciante</h2>
            <p className="text-muted-foreground">
              Fornecer arte conforme especificações técnicas, honrar os pagamentos das campanhas
              aprovadas e respeitar as regras de conteúdo (sem material ilegal, ofensivo ou enganoso).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">5. Pagamentos e repasses</h2>
            <p className="text-muted-foreground">
              Faturas e repasses são lançados manualmente pela equipe operacional. Os comprovantes
              ficam disponíveis nas áreas financeiras de cada perfil.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">6. Encerramento</h2>
            <p className="text-muted-foreground">
              Você pode encerrar sua conta a qualquer momento solicitando ao suporte. A Driver Ads
              pode suspender contas que violem estes termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">7. Privacidade</h2>
            <p className="text-muted-foreground">
              O tratamento dos dados pessoais segue a nossa <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
