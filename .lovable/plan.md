# Migração Pagou → Supabase Edge Functions

## Por que essa mudança

O plano original era 100% Edge Functions. Eu desviei e criei TanStack server functions (`src/lib/pagou/*.functions.ts`) que leem `process.env` do runtime do Lovable (Cloudflare Workers). Como suas chaves estão no cofre dos Edge Functions do Supabase, elas nunca chegam até esse runtime — daí o erro "Chave pública da Pagou não configurada".

A única coisa que segue esse caminho errado é o fluxo Pagou. Tudo o mais (auth, email hooks, password recovery) lê variáveis que são auto-provisionadas pelo Lovable nos dois runtimes (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) — não precisa migrar.

## O que vai ser criado (Edge Functions)

1. **`supabase/functions/_shared/pagou-client.ts`** — cliente HTTP da Pagou em Deno, lendo `PAGOU_API_TOKEN`, `PAGOU_BASE_URL`. Registra em `pagou_api_logs`.
2. **`supabase/functions/pagou-public-key/index.ts`** — `GET` retorna `{ public_key, environment }` lendo `PAGOU_PUBLIC_KEY` e `PAGOU_ENV`. Verifica JWT do usuário.
3. **`supabase/functions/pagou-create-subscription/index.ts`** — `POST` recebe `{ campaign_id, plan_id, token, card_* }`, valida com Zod, valida ownership via service-role + checagem `advertiser.user_id = auth.uid()`, garante customer (lógica embutida do `getOrCreatePagouCustomer`), cria assinatura na Pagou, persiste em `subscriptions`, atualiza `campaigns.billing_status='pending'`, escreve `audit_logs`.
4. **`supabase/functions/pagou-billing-state/index.ts`** — `GET ?campaign_id=...` retorna `{ campaign, subscription }` (usado pelo polling do checkout).

Webhook (`pagou-webhook`) já existe como Edge Function — fica.

## O que vai ser removido

- `src/lib/pagou/client.server.ts`
- `src/lib/pagou/customer.functions.ts`
- `src/lib/pagou/subscription.functions.ts`
- `src/lib/pagou/types.ts` → mantido (tipos compartilhados client-safe)

## O que muda no frontend

**`src/routes/_authenticated/anunciante/campanhas.$id.checkout.tsx`**
- Remover `useServerFn` e imports de `subscription.functions`.
- Substituir as três chamadas por `supabase.functions.invoke("pagou-public-key" | "pagou-create-subscription" | "pagou-billing-state", ...)`. A sessão do usuário já é injetada como Bearer automaticamente pelo client.

## Segredos

Tudo que a função precisa já está no cofre do Supabase (você confirmou): `PAGOU_PUBLIC_KEY`, `PAGOU_API_TOKEN`, `PAGOU_ENV`, `PAGOU_BASE_URL`, `PAGOU_WEBHOOK_SECRET`. Não vou usar nenhum `add_secret` do Lovable.

## Detalhes técnicos

- Todas as três novas funções: CORS aberto pra `*`, `OPTIONS` handler, `verify_jwt = true` no `config.toml` exceto a webhook que continua sem JWT.
- Cliente Pagou em Deno usa `fetch` nativo + `Deno.env.get`.
- Inserções em `pagou_api_logs`, `subscriptions`, `audit_logs`, update em `advertisers`/`campaigns` via `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)`.
- Idempotência por `external_ref = sub_campaign_{id}_v1` (mesma regra de hoje).
- Validação de payload com Zod (via `https://deno.land/x/zod`).

## Ordem de execução

1. Criar `_shared/pagou-client.ts` e as três funções novas.
2. Atualizar `campanhas.$id.checkout.tsx`.
3. Apagar os três arquivos antigos em `src/lib/pagou/`.
4. Deploy das funções e teste do botão "Assinar".
