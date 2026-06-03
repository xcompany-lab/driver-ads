# Driver Ads — Documentação Operacional

Plataforma operacional para gestão de publicidade física em veículos. Stack: TanStack Start + Supabase (Auth, DB, Storage, RLS). Sem matching automático — todas as atribuições são manuais pela operação.

## Perfis e portais

| Perfil | Portal | Permissões |
| --- | --- | --- |
| **Admin** | `/admin` | Acesso total. Pode aprovar cadastros, criar/editar campanhas, vincular motoristas, revisar comprovações, marcar pagamentos/repasses, excluir registros, ver auditoria. |
| **Operador** | `/admin` | Acesso operacional. Pode revisar cadastros e comprovações, gerenciar campanhas/vínculos. **Não pode** marcar pagamentos como pagos, gerar repasses, reverter status financeiro, excluir registros financeiros, nem acessar a auditoria. |
| **Anunciante** | `/anunciante` | Vê apenas seus dados, suas campanhas, comprovantes das suas campanhas e suas faturas. |
| **Motorista** | `/motorista` | Vê apenas seus dados, vínculos atribuídos, envia comprovações e acompanha repasses. |

Login separado por portal: `/auth/anunciante`, `/auth/motorista`, `/auth/admin`. O cadastro é livre apenas para anunciantes e motoristas; admin/operador são criados internamente (via SQL ou pelo admin atual).

## Status operacionais

### `advertisers.status` / `drivers.status` / `vehicles.status`
- `pending_review` — aguardando análise da operação
- `approved` — apto a operar
- `suspended` — bloqueado temporariamente
- `rejected` — recusado (somente drivers/advertisers)

### `campaigns.status`
- `pending_review` — solicitação enviada, aguardando análise
- `approved` — aprovada, pronta para vincular motoristas
- `active` — em circulação (tem vínculos ativos com instalação confirmada)
- `paused` — pausada temporariamente
- `completed` — encerrada por término de período
- `canceled` — cancelada antes de iniciar

### `campaign_driver_assignments.status`
- `invited` — operação enviou convite ao motorista
- `accepted` — motorista aceitou
- `awaiting_installation` — aceito e aguardando envio da foto de instalação
- `active` — instalação aprovada, em circulação
- `declined` — motorista recusou
- `completed` — vínculo encerrado

### `installation_proofs.status`
- `pending_review` — foto enviada, aguardando análise
- `approved` — instalação confirmada (libera o vínculo para `active`)
- `rejected` — reprovada definitivamente
- `resubmission_requested` — operação pediu nova foto

### `advertiser_payments.status` (fatura do anunciante)
- `pending` · `paid` · `overdue` · `cancelled`

### `driver_payouts.status` (repasse do motorista)
- `pending` · `processing` · `paid` · `cancelled`

## Buckets de Storage
- `avatars` (público) — foto de perfil
- `vehicles` (público) — foto do veículo
- `campaign-arts` (privado) — arte da campanha
- `installation-proofs` (privado) — fotos de instalação
- `payment-receipts` (privado) — comprovantes financeiros

## Integrações externas (não habilitadas no MVP)
- E-mail transacional (Resend) — ganchos em `notify_user` prontos
- WhatsApp — TODO
- Gateway de pagamento — controle manual no MVP

## Eventos auditados (`activity_logs`)
Todas as transições de status de campanha, vínculo, comprovante, fatura e repasse geram entrada automática via triggers Postgres. Acessível em `/admin/auditoria` apenas para Admin.
