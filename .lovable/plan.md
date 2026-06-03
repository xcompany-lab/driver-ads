# Plano: Reescrita do Plano Mestre Driver Ads como Checklist

Vou gerar um documento `.md` reescrito do plano mestre, mantendo a estrutura original (seções 1–23) e adicionando, em cada item de entrega/fase/regra, uma marcação de status:

- `[x]` — implementado e verificável no código atual
- `[~]` — parcialmente implementado (com nota do que falta)
- `[ ]` — não iniciado

O arquivo final será salvo em `/mnt/documents/driver_ads_plano_checklist.md` e disponibilizado como artefato para download.

## Mapeamento do estado atual (base da auditoria)

Levantado a partir de `supabase/migrations/`, `src/routes/`, `src/lib/` e `.lovable/plan.md`:

**Implementado (`[x]`)**
- Stack TanStack Start + Supabase (Auth, DB, Storage, RLS).
- Migrations criadas: profiles, user_roles + `has_role()`, advertisers, drivers, vehicles, campaigns, campaign_assets, campaign_driver_assignments, installation_proofs, advertiser_payments, driver_payouts, admin_notes, activity_logs, notifications, system_settings.
- Enum `app_role` (admin, operator, advertiser, driver) e enums de status operacionais.
- Status granular de documentos do motorista (`doc_review_status` + colunas `cnh_front_status`, `selfie_doc_status`, `address_proof_status`, `crlv_status`).
- Auth separado por perfil: `/auth`, `/auth/anunciante`, `/auth/motorista`, `/auth/admin`.
- Layout `_authenticated` com redirect por role.
- Painel Admin: dashboard (`index`), anunciantes, motoristas, veículos, campanhas (lista + detalhe), comprovações, auditoria, financeiro.
- Aprovação/reprovação por documento individual no admin (CNH, selfie, comprovante, CRLV).
- Portal Anunciante: index, perfil, financeiro.
- Área Motorista (mobile-first): index, perfil, veículos, campanhas, ganhos, auditoria (verificação de identidade + foto de instalação atrelada à campanha).
- Upload de documentos com preview de imagem e PDF (`DocumentUploadField`, `DocumentPreview`).
- Storage buckets configurados (avatars, vehicles, campaign-arts, installation-proofs, payment-receipts).
- Páginas Termos e Privacidade.
- Notificações in-app (NotificationBell + `/notificacoes`).
- Conta admin seed: `guime.eventos@gmail.com`.
- Design system: tokens em `src/styles.css`, Montserrat + Inter, logo.

**Parcial (`[~]`)**
- Operador interno: role existe no enum, sem UI/permissões diferenciadas.
- Pagamentos/repasses: tabelas e tela financeira existem; falta fluxo completo de marcar pago + anexar comprovante PIX e cálculo automático de repasse por vínculo ativo.
- Relatório do anunciante: dados visíveis na tela da campanha; falta um "relatório" consolidado dedicado.
- Activity logs: tabela existe; falta gravação sistemática em todas as ações críticas.
- LGPD: termos publicados; falta exportação de dados do usuário.
- Vinculação manual admin↔motorista: assignments existem no schema; revisar se a tela de "vincular motorista à campanha" cobre todos os filtros e transições de status descritos na Fase 5.

**Não iniciado (`[ ]`)**
- Integrações externas: Resend (email), WhatsApp, gateway de pagamento.
- App Android (fora do MVP, mantido em roadmap).
- Documentação técnica final / README de operação (existe `docs/OPERACAO.md` parcial).
- Checklist de produção (backup, domínio próprio em produção, remoção de usuários de teste, etc.).

## Formato do documento entregue

Manter a numeração 1–23 original. Para as seções 10 (Fases) e 14 (Regras de Negócio) cada bullet vira um checkbox. Adicionar duas seções novas no final:

- **24. Resumo do Progresso** — contagem por fase (`x/total` itens) e barra textual.
- **25. Próximos Passos Prioritários** — lista ordenada das pendências críticas para fechar o MVP (operador, fluxo completo de pagamentos/repasses, activity_logs em ações críticas, relatório consolidado do anunciante, checklist de produção).

Preservar integralmente as seções de "Fora do Escopo", "Riscos", "Roadmap Pós-MVP" e a "Regra de Ouro" (sem matching) — apenas marcadas como referência, sem checkboxes.

## Entrega

Um único arquivo:

```
/mnt/documents/driver_ads_plano_checklist.md
```

Disponibilizado via `<presentation-artifact>` para download direto.
