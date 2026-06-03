## Objetivo

Resolver o link de confirmação caindo em `localhost` e centralizar todo o envio de e-mail do Driver Ads no Resend, com remetente `suporte@driverads.com.br`.

## Por que o link cai em localhost

Hoje o cadastro chama `supabase.auth.signUp(..., { emailRedirectTo: ${window.location.origin}/auth })`. Quando você testa em ambiente de preview/local, `window.location.origin` vira `localhost` (ou o preview da Lovable) e a Supabase usa a **Site URL** do projeto como fallback — que ainda está apontando para localhost. O e-mail é o template padrão da Supabase, não passa pelo Resend.

## Pré-requisitos que você precisa fazer (1 vez só)

1. **Adicionar domínio no Resend** (https://resend.com/domains) → `driverads.com.br`. O Resend vai gerar 3 registros DNS (SPF, DKIM, DMARC) para colar no seu provedor de DNS.
2. **Atualizar Site URL no Supabase** → Dashboard → Authentication → URL Configuration:
   - Site URL: `https://driverads.com.br`
   - Redirect URLs (adicionar todas): `https://driverads.com.br/**`, `https://www.driverads.com.br/**`, `https://driver-ads.lovable.app/**`, `https://id-preview--f1dbd651-3cbb-43b9-9ae4-53e107d58496.lovable.app/**`

Eu mostro os links exatos no chat na hora.

## O que vou construir

### 1. Conexão com Resend
- Conectar o connector "Resend" do Lovable (gateway gerenciado, sem precisar colar API key manualmente).
- O secret `RESEND_API_KEY` fica disponível automaticamente nas server functions.

### 2. Endpoint de auth email hook
- Rota pública `src/routes/api/public/auth-email-hook.ts` que recebe o **Send Email Hook** da Supabase, valida a assinatura (HMAC com `SEND_EMAIL_HOOK_SECRET`), renderiza o template correspondente (`signup`, `recovery`, `email_change`, `magiclink`, `invite`) e envia via Resend.
- Você configura esse endpoint no Supabase Dashboard → Authentication → Hooks → Send Email Hook, apontando para `https://driverads.com.br/api/public/auth-email-hook`. A partir daí, **todos os e-mails de auth da Supabase passam pelo Resend** com a sua marca.

### 3. Templates HTML com identidade Driver Ads
- 5 templates de auth (confirmação de conta, recuperação de senha, magic link, troca de e-mail, convite).
- 4 templates transacionais:
  - **Cadastro aprovado/recusado** — disparado quando admin muda `advertisers.status`/`drivers.status` para `approved`/`rejected`.
  - **Convite de campanha** — disparado quando `campaign_driver_assignments` ganha linha com `status='invited'`.
  - **Comprovação revisada** — disparado quando `installation_proofs.status` vira `approved`/`rejected`/`resubmission_requested`.
  - **Repasse pago / fatura** — disparado quando `driver_payouts.status` vira `paid` (motorista) e quando `advertiser_payments` é criado/marcado pago (anunciante).
- Todos usam o gradiente azul Driver Ads, logo, e linkam de volta para o portal do destinatário.

### 4. Disparo dos transacionais
- Helper `src/lib/email/send.ts` → POSTa para `/api/public/transactional-email` (rota interna com verificação de origem) que renderiza + chama Resend.
- Triggers Postgres em cada uma das tabelas acima inserem em uma fila `email_outbox` (tabela nova) com `template`, `to`, `data`.
- Server function `processEmailOutbox` é chamada por pg_cron a cada 1 min para enviar os pendentes (evita perda em caso de falha do Resend e dá retry).

### 5. Correção do link localhost
- Ajustar `signUpAdvertiser`/`signUpDriver` para usar a URL pública configurada (`VITE_PUBLIC_SITE_URL=https://driverads.com.br`) como `emailRedirectTo`, com fallback para `window.location.origin` em dev.
- Combinado com a atualização da Site URL no Supabase, os links de confirmação passam a abrir no domínio de produção.

## Arquivos novos / alterados

```
src/routes/api/public/auth-email-hook.ts        (novo — webhook Supabase → Resend)
src/routes/api/public/transactional-email.ts    (novo — endpoint interno)
src/lib/email/
  ├── send.ts                                   (novo — helper)
  ├── resend.server.ts                          (novo — wrapper do gateway)
  ├── render.server.ts                          (novo — renderiza templates)
  └── templates/
      ├── auth-signup.ts
      ├── auth-recovery.ts
      ├── auth-magiclink.ts
      ├── auth-email-change.ts
      ├── auth-invite.ts
      ├── account-approved.ts
      ├── account-rejected.ts
      ├── campaign-invite.ts
      ├── proof-reviewed.ts
      └── payout-paid.ts
src/lib/auth.ts                                 (ajustar emailRedirectTo)

Migration:
  - tabela email_outbox (id, template, to_email, payload, status, attempts, last_error, sent_at, created_at)
  - triggers em advertisers/drivers/campaign_driver_assignments/installation_proofs/driver_payouts/advertiser_payments
  - pg_cron job chamando o endpoint processador a cada 1 min
```

## Secrets que vou pedir

- `SEND_EMAIL_HOOK_SECRET` — gerado por você no Supabase Dashboard ao criar o hook (cole o valor exibido lá).
- `RESEND_API_KEY` — vem automaticamente ao conectar o connector Resend, não precisa colar manualmente.

## Riscos / pontos de atenção

- **DNS do Resend leva até 72h** (geralmente <1h). Enquanto não verificar, os e-mails vão falhar com "domain not verified". Posso deixar tudo codado e você só ativa o hook na Supabase depois que o domínio aparecer como "Verified".
- O Send Email Hook **substitui** os e-mails padrão da Supabase; se o endpoint ficar fora do ar, ninguém recebe e-mail de auth. A fila `email_outbox` mitiga isso para os transacionais, mas para auth a Supabase chama síncrono — vou logar erros para você ver em `/admin/auditoria`.
- Os e-mails transacionais dependem de triggers; se uma migration falhar, posso reverter sem afetar os dados existentes.
