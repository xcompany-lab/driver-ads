import { createFileRoute } from "@tanstack/react-router";
import {
  FileText, BookOpen, UserCheck, Car, Megaphone, ShieldCheck,
  Award, AlertTriangle, Ban, RefreshCw, Scale, Mail, CreditCard,
} from "lucide-react";
import LegalPageLayout, { type LegalSection } from "@/components/legal/LegalPageLayout";

const sections: LegalSection[] = [
  {
    id: "aceitacao",
    title: "Aceitação dos Termos",
    icon: FileText,
    content: (
      <>
        <p>Ao acessar e utilizar a plataforma Driver Ads ("Plataforma"), você concorda integralmente com estes Termos de Uso. Caso não concorde com qualquer disposição, não utilize a Plataforma.</p>
        <p>O uso continuado após quaisquer alterações nestes Termos constitui aceitação das modificações realizadas.</p>
      </>
    ),
  },
  {
    id: "definicoes",
    title: "Definições",
    icon: BookOpen,
    content: (
      <ul className="list-disc pl-5 space-y-2">
        <li><strong className="text-foreground">Driver Ads:</strong> plataforma operacional de mídia publicitária aplicada a veículos.</li>
        <li><strong className="text-foreground">Anunciante:</strong> pessoa jurídica que contrata espaços publicitários nos veículos cadastrados.</li>
        <li><strong className="text-foreground">Motorista:</strong> pessoa física habilitada que disponibiliza seu veículo para veicular a publicidade contratada.</li>
        <li><strong className="text-foreground">Campanha:</strong> conjunto de peças publicitárias, período, regiões e veículos selecionados pelo Anunciante.</li>
        <li><strong className="text-foreground">Comprovação de instalação:</strong> evidência (foto e dados operacionais) enviada pelo Motorista após a aplicação da arte.</li>
        <li><strong className="text-foreground">Repasse:</strong> valor pago ao Motorista pela veiculação durante o período contratado.</li>
      </ul>
    ),
  },
  {
    id: "cadastro",
    title: "Cadastro e Conta",
    icon: UserCheck,
    content: (
      <>
        <p>Para utilizar a Plataforma, o Usuário deve criar conta fornecendo informações verdadeiras, completas e atualizadas. O Usuário é responsável por manter a confidencialidade de suas credenciais.</p>
        <p>Cada conta é pessoal e intransferível. Cadastros incompletos, inconsistentes ou com documentação fraudulenta podem ser reprovados ou suspensos.</p>
        <p>Motoristas devem possuir CNH válida e veículo apto à instalação da arte. Anunciantes devem fornecer dados cadastrais completos (CNPJ, responsável, faturamento).</p>
      </>
    ),
  },
  {
    id: "motoristas",
    title: "Responsabilidades do Motorista",
    icon: Car,
    content: (
      <ul className="list-disc pl-5 space-y-2">
        <li>Manter o veículo em boas condições de conservação e circulação durante toda a campanha.</li>
        <li>Conservar a arte aplicada sem alterações, recortes ou sobreposições não autorizadas.</li>
        <li>Enviar comprovante de instalação verídico (foto do veículo com a arte aplicada e, quando solicitado, geolocalização).</li>
        <li>Cumprir o período contratado da campanha e comunicar imediatamente qualquer dano à arte.</li>
        <li>Respeitar a legislação de trânsito e as regras de circulação das cidades onde opera.</li>
      </ul>
    ),
  },
  {
    id: "anunciantes",
    title: "Responsabilidades do Anunciante",
    icon: Megaphone,
    content: (
      <ul className="list-disc pl-5 space-y-2">
        <li>Fornecer arte publicitária conforme as especificações técnicas indicadas pela Plataforma.</li>
        <li>Garantir que o conteúdo da campanha não viole leis, direitos de terceiros, normas de publicidade (CONAR) ou contenha material ofensivo, enganoso ou ilegal.</li>
        <li>Honrar os pagamentos das campanhas aprovadas conforme prazos e condições contratadas.</li>
        <li>Reconhecer que a Driver Ads é uma plataforma operacional de mídia física, sem promessas automáticas de matching, alcance, conversão ou métricas de impacto.</li>
      </ul>
    ),
  },
  {
    id: "pagamentos",
    title: "Pagamentos e Repasses",
    icon: CreditCard,
    content: (
      <>
        <p>Faturas para Anunciantes e repasses para Motoristas são processados manualmente pela equipe operacional, com base nas campanhas aprovadas e nas comprovações de instalação validadas.</p>
        <p>Os comprovantes ficam disponíveis nas áreas financeiras de cada perfil. Inadimplência por parte do Anunciante pode resultar em suspensão da campanha em curso.</p>
        <p>Repasses ao Motorista ocorrem após validação da comprovação e conforme o cronograma definido para cada campanha.</p>
      </>
    ),
  },
  {
    id: "dados-privacidade",
    title: "Dados e Privacidade",
    icon: ShieldCheck,
    content: (
      <>
        <p>O tratamento de dados pessoais pela Plataforma está descrito em nossa <a href="/privacidade" className="text-primary hover:underline">Política de Privacidade</a>, que é parte integrante destes Termos.</p>
        <p>O Usuário declara estar ciente e concordar com o tratamento de seus dados conforme a LGPD (Lei nº 13.709/2018).</p>
      </>
    ),
  },
  {
    id: "propriedade-intelectual",
    title: "Propriedade Intelectual",
    icon: Award,
    content: (
      <>
        <p>Todo o conteúdo da Plataforma — software, design, logotipos, textos, gráficos e interfaces — é de propriedade exclusiva da Driver Ads ou de seus licenciadores. É vedada a reprodução, modificação, distribuição ou engenharia reversa.</p>
        <p>A arte publicitária permanece de propriedade do Anunciante. As fotos enviadas pelo Motorista (veículo, instalação) são utilizadas exclusivamente para fins operacionais e de auditoria.</p>
      </>
    ),
  },
  {
    id: "limitacao-responsabilidade",
    title: "Limitação de Responsabilidade",
    icon: AlertTriangle,
    content: (
      <>
        <p>A Driver Ads não se responsabiliza por:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Indisponibilidade temporária da Plataforma por motivos técnicos, manutenção ou força maior.</li>
          <li>Danos ao veículo do Motorista decorrentes de uso indevido por terceiros ou má conservação.</li>
          <li>Métricas de exposição, alcance ou conversão da campanha — a Plataforma é operacional, não publicitária por desempenho.</li>
          <li>Conteúdo publicitário fornecido pelo Anunciante e suas consequências legais.</li>
          <li>Danos indiretos, incidentais ou consequentes de qualquer natureza.</li>
        </ul>
        <p>A responsabilidade total da Driver Ads está limitada ao valor pago pelo Usuário nos últimos 3 meses de uso.</p>
      </>
    ),
  },
  {
    id: "suspensao-cancelamento",
    title: "Suspensão e Cancelamento",
    icon: Ban,
    content: (
      <>
        <p>A Driver Ads pode suspender ou cancelar contas nos seguintes casos:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Violação destes Termos de Uso.</li>
          <li>Comprovação de instalação fraudulenta ou adulterada.</li>
          <li>Inadimplência reiterada do Anunciante.</li>
          <li>Conteúdo publicitário ilegal, ofensivo ou enganoso.</li>
          <li>Compartilhamento de credenciais com terceiros.</li>
        </ul>
        <p>O Usuário pode encerrar sua conta a qualquer momento solicitando ao suporte. Após o encerramento, os dados são retidos por 30 dias antes da exclusão definitiva.</p>
      </>
    ),
  },
  {
    id: "modificacoes",
    title: "Modificações dos Termos",
    icon: RefreshCw,
    content: (
      <p>A Driver Ads reserva-se o direito de alterar estes Termos a qualquer momento. As alterações serão comunicadas pela Plataforma ou por e-mail. O uso continuado após a notificação constitui aceitação dos novos termos.</p>
    ),
  },
  {
    id: "lei-aplicavel",
    title: "Lei Aplicável e Foro",
    icon: Scale,
    content: (
      <>
        <p>Estes Termos são regidos pelas leis da República Federativa do Brasil.</p>
        <p>Fica eleito o foro da comarca da sede da Driver Ads para dirimir quaisquer controvérsias decorrentes destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
      </>
    ),
  },
  {
    id: "contato",
    title: "Contato",
    icon: Mail,
    content: (
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-foreground">E-mail:</strong> contato@driverads.com.br</li>
        <li><strong className="text-foreground">Suporte:</strong> através do painel da Plataforma</li>
      </ul>
    ),
  },
];

export const Route = createFileRoute("/termos")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso · Driver Ads" },
      { name: "description", content: "Termos de uso da plataforma Driver Ads para motoristas e anunciantes." },
    ],
  }),
});

function TermsPage() {
  return (
    <LegalPageLayout
      title="Termos de Uso"
      icon={FileText}
      lastUpdated={new Date().toLocaleDateString("pt-BR")}
      sections={sections}
    />
  );
}
