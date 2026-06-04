// Email template renderers for Driver Ads transactional emails.
// Each renderer returns { subject, html }.

const BRAND = {
  name: "Driver Ads",
  url: "https://driverads.com.br",
  primary: "#1d4ed8",
  primaryDark: "#1e3a8a",
  bg: "#f6f8fb",
  text: "#0f172a",
  muted: "#475569",
};

function fmtMoney(v: unknown) {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(v: unknown) {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtMonth(v: unknown) {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function shell(title: string, bodyInner: string, cta?: { label: string; href: string }) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.06);">
      <tr><td style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});padding:28px 32px;">
        <div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-.01em;">Driver Ads</div>
      </td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${BRAND.text};">${title}</h1>
        ${bodyInner}
        ${cta ? `<div style="margin-top:28px;"><a href="${cta.href}" style="display:inline-block;background:${BRAND.primary};color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;">${cta.label}</a></div>` : ""}
      </td></tr>
      <tr><td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;color:${BRAND.muted};font-size:12px;line-height:1.5;">
        Driver Ads — mídia em movimento.<br/>
        Em caso de dúvidas, responda este e-mail ou escreva para suporte@driverads.com.br.
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

function p(text: string) {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:${BRAND.text};">${text}</p>`;
}
function muted(text: string) {
  return `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${BRAND.muted};">${text}</p>`;
}

function ctaUrl(path?: string) {
  const safe = typeof path === "string" && path.startsWith("/") ? path : "/";
  return `${BRAND.url}${safe}`;
}

type Payload = Record<string, unknown>;
type Rendered = { subject: string; html: string };

const RENDERERS: Record<string, (d: Payload) => Rendered> = {
  "account-approved": (d) => {
    const isAdv = d.kind === "advertiser";
    const name = String(d.name ?? "");
    return {
      subject: isAdv ? "Sua conta de anunciante foi aprovada 🎉" : "Sua conta de motorista foi aprovada 🎉",
      html: shell(
        "Conta aprovada",
        p(`Olá ${name}, sua conta foi aprovada pela equipe Driver Ads.`) +
          p(isAdv ? "Agora você já pode criar campanhas e acompanhar resultados pelo portal." : "Agora você já pode receber convites de campanhas pelo portal do motorista."),
        { label: "Acessar portal", href: ctaUrl(String(d.portal_path)) }
      ),
    };
  },
  "account-rejected": (d) => {
    const name = String(d.name ?? "");
    return {
      subject: "Atualização do seu cadastro Driver Ads",
      html: shell(
        "Cadastro não aprovado",
        p(`Olá ${name}, infelizmente seu cadastro não foi aprovado neste momento.`) +
          p("Nossa equipe pode entrar em contato para complementar informações. Você também pode responder este e-mail."),
        { label: "Falar com suporte", href: "mailto:suporte@driverads.com.br" }
      ),
    };
  },
  "campaign-invite": (d) => ({
    subject: `Novo convite de campanha: ${String(d.campaign_name ?? "")}`,
    html: shell(
      "Você recebeu um convite de campanha",
      p(`Olá ${String(d.driver_name ?? "")}, você foi convidado para a campanha <strong>${String(d.campaign_name ?? "")}</strong> em ${String(d.city ?? "")}.`) +
        muted(`Período: ${fmtDate(d.period_start)} até ${fmtDate(d.period_end)}`) +
        muted(`Repasse mensal previsto: <strong>${fmtMoney(d.monthly_payout)}</strong>`) +
        p("Acesse o portal para aceitar ou recusar o convite."),
      { label: "Ver convite", href: ctaUrl(String(d.portal_path)) }
    ),
  }),
  "proof-reviewed": (d) => {
    const status = String(d.status ?? "");
    const label =
      status === "approved" ? "Comprovação aprovada" :
      status === "rejected" ? "Comprovação reprovada" : "Reenvio de foto solicitado";
    const reason = d.reason ? muted(`Motivo: ${String(d.reason)}`) : "";
    return {
      subject: `${label} — ${String(d.campaign_name ?? "")}`,
      html: shell(
        label,
        p(`Olá ${String(d.driver_name ?? "")}, a comprovação da campanha <strong>${String(d.campaign_name ?? "")}</strong> foi revisada.`) + reason,
        { label: "Abrir portal", href: ctaUrl(String(d.portal_path)) }
      ),
    };
  },
  "payout-paid": (d) => ({
    subject: `Repasse enviado — ${fmtMoney(d.amount)}`,
    html: shell(
      "Seu repasse foi enviado",
      p(`Olá ${String(d.driver_name ?? "")}, enviamos o repasse de <strong>${fmtMoney(d.amount)}</strong> referente a ${fmtMonth(d.reference_month)}.`) +
        (d.paid_at ? muted(`Pago em ${fmtDate(d.paid_at)}`) : ""),
      { label: "Ver ganhos", href: ctaUrl(String(d.portal_path)) }
    ),
  }),
  "invoice-created": (d) => ({
    subject: `Nova fatura — ${fmtMoney(d.amount)}`,
    html: shell(
      "Nova fatura disponível",
      p(`Olá ${String(d.name ?? "")}, geramos uma fatura de <strong>${fmtMoney(d.amount)}</strong> referente à campanha <strong>${String(d.campaign_name ?? "")}</strong>.`) +
        muted(`Vencimento: ${fmtDate(d.due_date)}`),
      { label: "Ver fatura", href: ctaUrl(String(d.portal_path)) }
    ),
  }),
  "invoice-paid": (d) => ({
    subject: "Pagamento confirmado",
    html: shell(
      "Recebemos seu pagamento",
      p(`Olá ${String(d.name ?? "")}, confirmamos o pagamento de <strong>${fmtMoney(d.amount)}</strong> referente à campanha <strong>${String(d.campaign_name ?? "")}</strong>.`) +
        (d.paid_at ? muted(`Pago em ${fmtDate(d.paid_at)}`) : ""),
      { label: "Ver financeiro", href: ctaUrl(String(d.portal_path)) }
    ),
  }),
  "auth-signup": (d) => ({
    subject: "Confirme seu e-mail — Driver Ads",
    html: shell(
      "Confirme seu e-mail",
      p("Olá, recebemos seu cadastro na Driver Ads. Para ativar sua conta, confirme o e-mail clicando no botão abaixo.") +
        muted("Se você não criou esta conta, ignore este e-mail."),
      { label: "Confirmar e-mail", href: String(d.action_url ?? "") }
    ),
  }),
  "auth-magiclink": (d) => ({
    subject: "Seu link de acesso — Driver Ads",
    html: shell(
      "Acesse sua conta",
      p("Use o link abaixo para entrar na sua conta Driver Ads. O link expira em 1 hora.") +
        muted("Se você não solicitou, pode ignorar este e-mail."),
      { label: "Entrar agora", href: String(d.action_url ?? "") }
    ),
  }),
  "auth-recovery": (d) => ({
    subject: "Redefinir sua senha — Driver Ads",
    html: shell(
      "Redefinir senha",
      p("Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para escolher uma nova senha.") +
        muted("Se você não solicitou, ignore este e-mail; sua senha continua a mesma."),
      { label: "Redefinir senha", href: String(d.action_url ?? "") }
    ),
  }),
  "auth-email-change": (d) => ({
    subject: "Confirme o novo e-mail — Driver Ads",
    html: shell(
      "Confirme a troca de e-mail",
      p(`Você solicitou alterar o e-mail da sua conta Driver Ads para <strong>${String(d.new_email ?? "")}</strong>.`) +
        p("Confirme clicando no botão abaixo."),
      { label: "Confirmar novo e-mail", href: String(d.action_url ?? "") }
    ),
  }),
  "auth-invite": (d) => ({
    subject: "Você foi convidado para a Driver Ads",
    html: shell(
      "Bem-vindo à Driver Ads",
      p("Você foi convidado a acessar a Driver Ads. Clique no botão abaixo para definir sua senha e entrar."),
      { label: "Aceitar convite", href: String(d.action_url ?? "") }
    ),
  }),
};

export function renderEmail(template: string, payload: Payload): Rendered | null {
  const fn = RENDERERS[template];
  if (!fn) return null;
  return fn(payload ?? {});
}
