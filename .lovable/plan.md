## Integração financeira Driver Ads + Pagou.ai

Documento de 2.620 linhas + adendo. Escopo enorme — vou implementar em **fases entregáveis**, começando agora pelas Fases 1–4 (fundação + webhook + checkout cartão recorrente). Depois confirmamos cada fase antes de seguir.

## Decisões de arquitetura (importante ler)

1. **Webhook fica em Supabase Edge Function** (`supabase/functions/pagou-webhook/index.ts`). Razão: os 3 webhooks da Pagou.ai já estão apontados para `/functions/v1/pagou-webhook` e o token já está em `PAGOU_WEBHOOK_SECRET`. Mudar URL agora quebraria a integração.
2. **Demais chamadas server-to-server** (criar customer, assinatura, Pix, Pix Out, reconciliar) ficam em **TanStack server functions** (`createServerFn`) seguindo o padrão do projeto. Helper único `src/lib/pagou/client.server.ts` para chamar a Pagou.
3. **Tabelas existentes serão estendidas, não substituídas.** O projeto já tem `advertisers`, `drivers`, `campaigns`, `vehicles`, `campaign_driver_assignments`, `advertiser_payments`, `driver_payouts`. Vou **adicionar colunas** Pagou e **criar novas tabelas** específicas (subscriptions, billing_transactions, ledger_entries, driver_payout_methods, driver_earnings, pagou_webhook_events, operational_tasks, pagou_api_logs, provider_balance_snapshots). As tabelas antigas `advertiser_payments` e `driver_payouts` ficam como histórico/registro manual paralelo até a Fase 10, quando consolidamos.
4. **Secrets**: já existem (`PAGOU_*`). Vou adicionar apenas `VITE_PAGOU_PUBLIC_KEY` no `.env` do frontend (espelho de `PAGOU_PUBLIC_KEY`).
5. **Sem matching automático** — operação Admin continua manual.
6. **Variáveis Pagou no contrato**: o documento alterna `PAGOU_SECRET_TOKEN` / `PAGOU_API_TOKEN`. Vou usar `PAGOU_API_TOKEN` (nome já cadastrado).

## Fase 1 — Banco de dados (esta entrega)

Migration única adicionando enums, colunas e tabelas:

### Enums novos
`billing_status`, `payment_method_type`, `driver_payout_method_status`, `earning_status`, `ledger_entry_type`, `webhook_processing_status`, `pagou_subscription_status`, `pagou_transaction_status`, `pagou_transfer_status`.

### Colunas adicionadas em tabelas existentes
- `advertisers`: `pagou_customer_id text unique`, `document_type`, `address jsonb`.
- `campaigns`: `plan_id uuid`, `billing_status`, `operational_status`, `current_period_start/end`, `payment_grace_until`, `removal_required_at`.
- `drivers`: nenhuma — `pix_key` já existe; vamos migrar para tabela dedicada `driver_payout_methods` na Fase 9.
- `campaign_driver_assignments`: nenhuma por ora.

### Tabelas novas
`campaign_plans`, `subscriptions`, `billing_transactions`, `pagou_webhook_events`, `pagou_api_logs`, `pagou_reconciliation_jobs`, `driver_payout_methods`, `driver_earnings`, `payouts`, `payout_items`, `ledger_entries`, `operational_tasks`, `provider_balance_snapshots`, `audit_logs` (renomeado de `activity_logs`? **não** — mantemos `activity_logs` e criamos `audit_logs` focado em eventos financeiros).

### Views
`admin_finance_summary`, `driver_available_earnings`.

### RLS e GRANTs
Padrão do projeto: GRANT para `authenticated`/`service_role`, RLS por papel (`has_role`/`is_staff`). Advertiser vê seus subs/transactions/earnings; Driver vê seus earnings/payouts/payout_methods; Staff vê tudo; Admin executa mutações financeiras. `service_role` (edge function webhook) escreve em `pagou_webhook_events`, `billing_transactions`, `subscriptions`, `payouts`, `driver_earnings`, `ledger_entries`.

## Fase 2 — Helper Pagou + Edge Function webhook

- `supabase/functions/pagou-webhook/index.ts`: valida `PAGOU_WEBHOOK_SECRET` (header), salva payload bruto em `pagou_webhook_events`, deduplica por `pagou_event_id`, responde `200` imediato. Processa síncrono mas com try/catch — falhas marcam `processing_status='failed'` e ficam para reconciliação.
- Roteamento por `event` (`subscription` | `transaction` | `payout`/`transfer`) + `event_type` interno. Eventos desconhecidos → status `unhandled`.
- Handlers organizados em arquivos: `_lib/handlers/subscription.ts`, `transaction.ts`, `payout.ts`, `_lib/pagou-client.ts`, `_lib/db.ts` (Supabase service role).
- `src/lib/pagou/client.server.ts`: wrapper `pagouRequest(path, init)` para uso em server functions TanStack (Bearer `PAGOU_API_TOKEN`, base `PAGOU_BASE_URL`, captura `requestId`, loga em `pagou_api_logs`, nunca loga token).

## Fase 3 — Customer do anunciante

- Server fn `getOrCreatePagouCustomer(advertiserId)` em `src/lib/pagou/customer.functions.ts`. Idempotente via `pagou_customer_id` salvo.
- Chamada automática no início do checkout (Fase 4).

## Fase 4 — Checkout cartão recorrente (Payment Element)

- Rota `/anunciante/campanhas/$id/checkout` (substitui necessidade de tela genérica).
- Carrega `https://js.pagou.ai/payments/v3.js` no `<head>` da rota.
- `VITE_PAGOU_PUBLIC_KEY` + `VITE_PAGOU_ENVIRONMENT` no `.env`.
- Componente `<PagouCardElement>` que monta iframe, valida, tokeniza e envia `pgct_*` para server fn `createSubscription({ campaignId, planId, token, brand, last4, exp })`.
- Server fn cria customer (se preciso), chama `POST /v2/subscriptions` com `idempotency_key=sub_campaign_<id>_v1`, persiste em `subscriptions`, atualiza `campaigns.billing_status='pending'`, retorna estado provisório.
- UI: nunca marca campanha como ativa pela resposta — exibe "aguardando confirmação", reflete real-time o `billing_status` (polling de 3s por 30s ou subscription Realtime).
- 3DS conduzido pelo SDK Pagou (`next_action`).

## Fase 5 — Handlers de webhook de assinatura

- `subscription.created/started/renewed/payment_failed/past_due/canceled/chargeback_received` → atualiza `subscriptions`, `campaigns.billing_status`, cria `billing_transactions` quando `latest_transaction` chega, gera `ledger_entries` de receita, cria `operational_tasks` (remoção/troca) e notifica via `notify_user`.
- Regra central: campanha só fica `operational_status='active'` se `billing_status in ('active','trialing')` E período vigente E não em chargeback.

## Próximas fases (planejadas, não implementadas agora)

- **Fase 6** — Pix pré-pago (criar Pix transaction + handler `transaction.paid`).
- **Fase 7** — Geração de `driver_earnings` por competência ao renovar assinatura.
- **Fase 8** — `/motorista/pix` cadastro Pix + aprovação Admin.
- **Fase 9** — `/admin/finance/payouts` Pix Out + handler `payout.*`.
- **Fase 10** — Reconciliação manual + rotinas agendadas (pg_cron disparando `/api/public/pagou-reconcile`).
- **Fase 11** — `/admin/finance` (resumo, assinaturas, inadimplência, repasses, webhooks, auditoria).
- **Fase 12** — Cancelamento/refund/chargeback + RLS final + testes e2e sandbox.

## Riscos e pontos de atenção

- **Pagou.ai SDK v3** carrega de CDN externo — adiciono `preconnect` no `<head>` da rota de checkout.
- **Idempotência**: toda criação de assinatura/transação/payout tem `external_ref` único calculado por campanha+período ou payout_id. `unique` constraints garantem não-duplicação no banco.
- **Edge Function precisa do service role** — usa env já disponível.
- **Migração de dados antigos**: `advertiser_payments` e `driver_payouts` existentes ficam intactos. Novas operações usam `billing_transactions`/`payouts`. Em produção, painel Admin mostrará ambos até reconciliação manual.
- **Conflito de nomes**: já existe `installation_proofs` no projeto. O documento chama de `installation_checks`. Mantenho `installation_proofs`.
- **Plano comercial**: ainda preciso saber o valor padrão do plano base. Vou criar `campaign_plans` vazio e o Admin cadastra antes de o primeiro checkout funcionar (seed opcional de "Driver Ads — Mensal R$500" para sandbox).

## O que vai mudar agora (Fases 1–4)

Arquivos:
```
supabase/migrations/<timestamp>_pagou_financial_foundation.sql   (NOVO — Fase 1)
supabase/functions/pagou-webhook/index.ts                          (NOVO — Fase 2)
supabase/functions/pagou-webhook/_lib/pagou-client.ts             (NOVO)
supabase/functions/pagou-webhook/_lib/db.ts                        (NOVO)
supabase/functions/pagou-webhook/_lib/handlers/{subscription,transaction,payout}.ts (NOVOS)
src/lib/pagou/client.server.ts                                     (NOVO — Fase 2)
src/lib/pagou/customer.functions.ts                                (NOVO — Fase 3)
src/lib/pagou/subscription.functions.ts                            (NOVO — Fase 4/5)
src/lib/pagou/types.ts                                             (NOVO)
src/components/checkout/PagouCardElement.tsx                       (NOVO — Fase 4)
src/routes/_authenticated/anunciante/campanhas.$id.checkout.tsx    (NOVO — Fase 4)
src/routes/__root.tsx                                              (EDIT — preload Pagou SDK só na rota de checkout via head())
.env                                                                (EDIT — VITE_PAGOU_PUBLIC_KEY/ENVIRONMENT)
```

Aprovo a abordagem e começo pela migration (Fase 1). Confirma?
