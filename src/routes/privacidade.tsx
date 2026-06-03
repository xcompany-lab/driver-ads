import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade · Driver Ads" },
      { name: "description", content: "Como tratamos seus dados pessoais na Driver Ads (LGPD)." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link to="/"><Logo size={32} /></Link>
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Início</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conformidade com a LGPD (Lei nº 13.709/2018). Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">Dados que coletamos</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><strong>Anunciantes</strong>: razão social, CNPJ, responsável, e-mail, telefone, cidade, segmento.</li>
              <li><strong>Motoristas</strong>: nome completo, CPF, data de nascimento, e-mail, telefone, cidade, regiões, chave PIX, fotos do motorista e do veículo.</li>
              <li><strong>Veículos</strong>: placa, modelo, marca, ano, cor, tipo, foto.</li>
              <li><strong>Operacionais</strong>: campanhas, vínculos, comprovantes de instalação (foto + geolocalização opcional), faturas e repasses.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Finalidades</h2>
            <p className="text-muted-foreground">
              Os dados são utilizados exclusivamente para operar a plataforma: aprovar cadastros,
              vincular motoristas a campanhas, processar pagamentos e repasses, auditar a entrega
              do serviço e comunicar atualizações.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Compartilhamento</h2>
            <p className="text-muted-foreground">
              Não vendemos seus dados. Compartilhamos apenas o necessário com o anunciante vinculado
              (placa, foto do veículo, foto da instalação) e com prestadores de infraestrutura
              (hospedagem e armazenamento de arquivos).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Armazenamento e segurança</h2>
            <p className="text-muted-foreground">
              Os dados são armazenados em ambiente Supabase com Row Level Security ativo, controlando
              o acesso por perfil. Arquivos sensíveis ficam em buckets privados acessíveis somente via
              URLs assinadas e temporárias.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Seus direitos (LGPD)</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Acessar, corrigir e atualizar seus dados pelo próprio perfil.</li>
              <li>Solicitar exclusão da conta a qualquer momento.</li>
              <li>Solicitar exportação dos seus dados pessoais.</li>
              <li>Revogar consentimentos específicos.</li>
            </ul>
            <Button variant="outline" className="mt-4" disabled>
              <Download className="mr-2 h-4 w-4" />Solicitar exportação (em breve)
            </Button>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Contato do encarregado (DPO)</h2>
            <p className="text-muted-foreground">
              Em caso de dúvidas sobre o tratamento dos seus dados, entre em contato pelo e-mail
              <a href="mailto:privacidade@driverads.com.br" className="text-primary underline ml-1">privacidade@driverads.com.br</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
