import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck, ClipboardList, Database, Share2, HardDrive,
  Lock, UserCheck, Cookie, RefreshCw, Mail,
} from "lucide-react";
import LegalPageLayout, { type LegalSection } from "@/components/legal/LegalPageLayout";

const sections: LegalSection[] = [
  {
    id: "introducao",
    title: "Introdução",
    icon: ShieldCheck,
    content: (
      <>
        <p>A Driver Ads está comprometida com a proteção da privacidade e dos dados pessoais de seus Usuários, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>
        <p>Esta Política descreve como coletamos, utilizamos, armazenamos, compartilhamos e protegemos os dados pessoais tratados pela Plataforma.</p>
      </>
    ),
  },
  {
    id: "dados-coletados",
    title: "Dados Coletados",
    icon: ClipboardList,
    content: (
      <>
        <h3 className="text-foreground font-semibold mt-4 mb-2">Anunciantes</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Razão social, CNPJ, responsável legal</li>
          <li>E-mail, telefone, cidade e segmento de atuação</li>
          <li>Dados de faturamento e pagamentos</li>
        </ul>
        <h3 className="text-foreground font-semibold mt-4 mb-2">Motoristas</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Nome completo, CPF, data de nascimento</li>
          <li>E-mail, telefone, cidade e regiões de circulação</li>
          <li>Chave PIX para recebimento de repasses</li>
          <li>Fotos do motorista (perfil) e do veículo</li>
        </ul>
        <h3 className="text-foreground font-semibold mt-4 mb-2">Veículos</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Placa, modelo, marca, ano, cor, tipo</li>
          <li>Foto do veículo</li>
        </ul>
        <h3 className="text-foreground font-semibold mt-4 mb-2">Operacionais</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Campanhas, vínculos motorista-campanha, comprovantes de instalação</li>
          <li>Foto da instalação e geolocalização opcional no momento da comprovação</li>
          <li>Faturas, repasses e histórico financeiro</li>
        </ul>
      </>
    ),
  },
  {
    id: "uso-dados",
    title: "Uso dos Dados",
    icon: Database,
    content: (
      <ul className="list-disc pl-5 space-y-2">
        <li><strong className="text-foreground">Operação da Plataforma:</strong> aprovar cadastros, vincular motoristas a campanhas, gerar comprovações e auditar a entrega do serviço.</li>
        <li><strong className="text-foreground">Pagamentos e repasses:</strong> processar faturas para anunciantes e repasses para motoristas.</li>
        <li><strong className="text-foreground">Comunicação:</strong> notificações sobre a conta, status de campanhas e suporte técnico.</li>
        <li><strong className="text-foreground">Auditoria:</strong> verificar a aplicação correta da arte publicitária por meio das fotos enviadas pelos motoristas.</li>
        <li><strong className="text-foreground">Melhoria contínua:</strong> aprimorar funcionalidades e experiência do Usuário.</li>
      </ul>
    ),
  },
  {
    id: "compartilhamento",
    title: "Compartilhamento de Dados",
    icon: Share2,
    content: (
      <>
        <p>Seus dados podem ser compartilhados nas seguintes situações:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong className="text-foreground">Anunciante vinculado:</strong> placa, foto do veículo e foto da instalação são compartilhadas com o anunciante da campanha como evidência de entrega.</li>
          <li><strong className="text-foreground">Provedores de infraestrutura:</strong> Supabase (banco de dados, autenticação e armazenamento de arquivos), em conformidade com padrões internacionais de segurança.</li>
          <li><strong className="text-foreground">Obrigações legais:</strong> quando exigido por lei, ordem judicial ou autoridade competente.</li>
        </ul>
        <p>Não vendemos, alugamos ou comercializamos dados pessoais.</p>
      </>
    ),
  },
  {
    id: "armazenamento",
    title: "Armazenamento e Retenção",
    icon: HardDrive,
    content: (
      <>
        <ul className="list-disc pl-5 space-y-2">
          <li>Banco de dados PostgreSQL com Row Level Security (RLS) ativo em todas as tabelas, controlando o acesso por perfil.</li>
          <li>Criptografia em trânsito (TLS/SSL) e em repouso.</li>
          <li>Arquivos sensíveis (documentos, fotos de instalação) ficam em buckets privados, acessíveis apenas via URLs assinadas e temporárias.</li>
          <li>Backups automáticos diários.</li>
        </ul>
        <p>Os dados são mantidos enquanto a conta estiver ativa. Após o encerramento, são retidos por 30 dias para possível reativação e depois excluídos.</p>
      </>
    ),
  },
  {
    id: "seguranca",
    title: "Segurança",
    icon: Lock,
    content: (
      <ul className="list-disc pl-5 space-y-2">
        <li>Autenticação segura com suporte a recuperação de senha por e-mail.</li>
        <li>Políticas de Row Level Security (RLS) garantem isolamento total de dados entre Usuários.</li>
        <li>Controle de acesso baseado em papéis (admin, anunciante, motorista).</li>
        <li>Chaves de API e tokens armazenados como variáveis de ambiente seguras.</li>
        <li>Monitoramento e registro de operações sensíveis na trilha de auditoria.</li>
      </ul>
    ),
  },
  {
    id: "direitos-usuario",
    title: "Direitos do Usuário (LGPD)",
    icon: UserCheck,
    content: (
      <>
        <p>Em conformidade com a LGPD, o Usuário tem direito a:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong className="text-foreground">Acesso:</strong> consultar e corrigir seus dados diretamente pelo perfil na Plataforma.</li>
          <li><strong className="text-foreground">Exclusão:</strong> solicitar a remoção da conta a qualquer momento.</li>
          <li><strong className="text-foreground">Portabilidade:</strong> solicitar a exportação dos dados pessoais.</li>
          <li><strong className="text-foreground">Revogação:</strong> retirar consentimentos específicos a qualquer momento.</li>
          <li><strong className="text-foreground">Informação:</strong> ser informado sobre as entidades com as quais os dados são compartilhados.</li>
        </ul>
        <p>Para exercer seus direitos, envie um e-mail para <span className="text-foreground">privacidade@driverads.com.br</span>.</p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies e Tecnologias",
    icon: Cookie,
    content: (
      <>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong className="text-foreground">Cookies essenciais:</strong> manter sessão autenticada do Usuário.</li>
          <li><strong className="text-foreground">Armazenamento local:</strong> preferências de interface (tema, navegação).</li>
        </ul>
        <p>Não utilizamos cookies de rastreamento publicitário de terceiros.</p>
      </>
    ),
  },
  {
    id: "alteracoes",
    title: "Alterações nesta Política",
    icon: RefreshCw,
    content: (
      <p>Esta Política pode ser atualizada periodicamente. Alterações serão comunicadas pela Plataforma e/ou por e-mail. Recomendamos a revisão periódica desta página.</p>
    ),
  },
  {
    id: "contato",
    title: "Contato do Encarregado (DPO)",
    icon: Mail,
    content: (
      <ul className="list-disc pl-5 space-y-1">
        <li><strong className="text-foreground">Controlador:</strong> Driver Ads</li>
        <li><strong className="text-foreground">E-mail (DPO):</strong> privacidade@driverads.com.br</li>
        <li><strong className="text-foreground">Suporte:</strong> contato@driverads.com.br</li>
      </ul>
    ),
  },
];

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade · Driver Ads" },
      { name: "description", content: "Como a Driver Ads trata seus dados pessoais (LGPD)." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Política de Privacidade"
      icon={ShieldCheck}
      lastUpdated={new Date().toLocaleDateString("pt-BR")}
      sections={sections}
    />
  );
}
