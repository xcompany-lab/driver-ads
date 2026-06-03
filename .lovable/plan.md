
# Driver Ads — Plano de Implementação em 15 Fases

Plataforma operacional de gestão de publicidade física em veículos. Sem matching automático. Perfis: Admin, Operador, Anunciante, Motorista. Stack: TanStack Start + Supabase (Auth, DB, Storage, RLS) + Lovable Cloud para serviços externos (email/WhatsApp futuros).

## Identidade Visual (aplicada em todas as fases)
- **Cores**: Azul Noturno `#041E4F` (background principal), Azul Elétrico `#1678FF` (primário/CTA), Cyan Mobility `#1FD0E8` (accent), Cinza Claro `#F4F7FA`, Cinza Escuro `#2E3440`. Gradiente oficial `#1678FF → #1FD0E8`.
- **Tipografia**: Montserrat Bold (títulos), Inter Regular/Medium (texto/UI).
- **Logo**: ícone com fundo (uploaded) em telas de login/splash; versão sem fundo em headers e documentos.
- **Tom**: profissional, mobility-tech, confiável.

---

## FASE 1 — Fundação Visual & Design System
- Configurar `src/styles.css` com tokens oklch das cores da marca, gradiente, sombras, raios.
- Importar Montserrat + Inter via Google Fonts.
- Salvar logo (com/sem fundo) em `src/assets/` como Lovable Assets.
- Criar variantes de Button (`hero`, `primary`, `outline-brand`), Card, Badge de status com cores semânticas (pending/approved/rejected/active).
- Layout shell base (sidebar admin, top-bar anunciante, bottom-nav mobile motorista).

## FASE 2 — Schema do Banco (Supabase) — Núcleo
Migration única criando:
- `profiles` (id=auth.uid, role, full_name, phone, avatar_url, created_at).
- `app_role` enum: `admin`, `operator`, `advertiser`, `driver`.
- `user_roles` (tabela separada) + função `has_role()` security definer.
- `advertisers` (company_name, cnpj, responsible, email, phone, city, segment, status).
- `drivers` (cpf, birth_date, phone, email, city, regions[], pix_key, photo_url, status, terms_accepted_at).
- `vehicles` (driver_id, plate, model, year, color, type, photo_url, status).
- RLS + GRANTs corretos em todas.

## FASE 3 — Autenticação Separada (Anunciante x Motorista x Admin)
- Configurar Supabase Auth (email/senha, sem confirmação no dev).
- Tela `/auth` única com **abas**: "Sou Anunciante" / "Sou Motorista" (login + cadastro).
- Tela `/admin/login` separada para Admin/Operador.
- Trigger `handle_new_user` cria `profiles` + grava `user_roles` baseado em metadata do signup.
- Layout `_authenticated` com redirect por role: motorista→`/driver`, anunciante→`/advertiser`, admin→`/admin`.
- Recuperação de senha + página `/reset-password`.

## FASE 4 — Schema do Banco — Operação
Migration:
- `campaigns` (advertiser_id, name, description, city, regions[], vehicles_qty, period_start/end, plan_value, art_url, observations, status).
- `campaign_assets` (campaign_id, file_url, type, uploaded_by).
- `campaign_driver_assignments` (campaign_id, driver_id, vehicle_id, status, monthly_payout, assigned_by, notes).
- `installation_proofs` (assignment_id, photo_url, submitted_at, geo_lat, geo_lng, observation, status, reviewed_by, reviewed_at, rejection_reason).
- Enums para todos os status operacionais.

## FASE 5 — Schema do Banco — Financeiro & Auditoria
- `advertiser_payments` (campaign_id, amount, due_date, paid_at, status, external_id, receipt_url).
- `driver_payouts` (assignment_id, driver_id, amount, period_ref, status, paid_at, receipt_url, pix_key_snapshot).
- `admin_notes` (entity_type, entity_id, note, created_by).
- `activity_logs` (actor_id, action, entity_type, entity_id, payload jsonb).
- `notifications` (user_id, type, title, body, read_at).
- `system_settings` (key, value jsonb).
- Storage buckets: `avatars`, `vehicles`, `campaign-arts`, `installation-proofs`, `payment-receipts` com policies adequadas.

## FASE 6 — Cadastro & Onboarding do Anunciante
- Wizard de cadastro (empresa, CNPJ, responsável, contato, cidade, segmento).
- Página "Aguardando aprovação" se status=`pending_review`.
- Edição de dados cadastrais.
- Server functions: `createAdvertiserProfile`, `updateAdvertiser`.

## FASE 7 — Cadastro & Onboarding do Motorista (Mobile-First)
- Cadastro multi-step responsivo: dados pessoais → veículo → PIX → fotos → termos LGPD.
- Upload de foto motorista + foto veículo (Storage).
- Validação CPF/placa.
- Tela "Cadastro em análise".
- Server functions: `createDriverProfile`, `addVehicle`, `acceptTerms`.

## FASE 8 — Portal do Anunciante: Campanhas
- Listagem de campanhas com filtros por status.
- Wizard "Nova solicitação de campanha" (nome, cidade, regiões, qtd veículos, período, plano, upload de arte, observações).
- Página de detalhe da campanha (status timeline, veículos vinculados quando aprovado, comprovantes).
- Relatório básico (somente dados operacionais confirmados — sem promessa de métricas).

## FASE 9 — Área do Motorista: Campanhas Atribuídas
- Bottom-nav: Início, Campanhas, Ganhos, Perfil.
- Lista de campanhas atribuídas manualmente (status do vínculo).
- Detalhe: aceitar/recusar, instruções, valor de repasse.
- Tela de envio de comprovação de instalação (câmera/upload, geo opcional, observação).
- Histórico de comprovantes e status.

## FASE 10 — Painel Administrativo: Dashboard & Gestão de Pessoas
- Dashboard com KPIs (anunciantes, motoristas, veículos, campanhas por status, instalações/pagamentos pendentes).
- Gestão de Anunciantes (listar, buscar, aprovar/suspender, notas internas).
- Gestão de Motoristas (listar, buscar, aprovar/reprovar/suspender, ver histórico).
- Gestão de Veículos (listar, vincular, aprovar/suspender).

## FASE 11 — Painel Administrativo: Campanhas & Vínculos Manuais
- CRUD de campanhas (criar manual, aprovar solicitação, editar, pausar, encerrar).
- Tela "Vincular Motoristas à Campanha": busca/filtros por cidade, status, veículo. Vincular/desvincular. Definir valor de repasse mensal.
- Transições de status do vínculo (convidado → aceito → aguardando instalação → ativo → ...).
- **Sem matching, sem sugestão automática, sem ranking.**

## FASE 12 — Painel Administrativo: Instalações & Comprovações
- Fila de comprovações pendentes.
- Visualizador de foto com EXIF/geo.
- Ações: aprovar / reprovar / solicitar nova foto (com motivo).
- Registro automático em `activity_logs`.

## FASE 13 — Financeiro: Pagamentos & Repasses
- Gestão de pagamentos de anunciantes (marcar pago, anexar comprovante, status).
- Gestão de repasses a motoristas (calcular valor por vínculo ativo, marcar pago/falhou, anexar comprovante PIX).
- Painel de ganhos do motorista (previsto, acumulado, histórico).
- Cálculo de margem bruta estimada no dashboard admin.

## FASE 14 — Notificações, Logs & LGPD
- Sistema de notificações in-app (sino no header, lista, marcar como lida).
- Eventos: campanha solicitada/aprovada, motorista aprovado, vínculo criado, instalação enviada/aprovada, pagamento/repasse.
- `activity_logs` em todas as ações administrativas críticas.
- Página de Termos de Uso + Política de Privacidade (LGPD).
- Exportar dados do usuário (placeholder para fase futura).
- **Integrações externas (email/WhatsApp via Resend) marcadas como TODO** — habilitar quando solicitado.

## FASE 15 — Polish, Permissões Finais & Operador Interno
- Perfil Operador Interno com permissões reduzidas (sem ações financeiras sensíveis).
- Revisão completa de RLS por role (testes manuais com cada perfil).
- Empty states, loadings, error boundaries em todas as rotas.
- Responsividade final (admin web, anunciante web, motorista mobile).
- Splash/login estilizados com logo.
- README técnico + documentação de status operacionais.

---

## Sobre integrações externas (Resend, WhatsApp, Gateway de Pagamento)
Não habilitadas no MVP. Ganchos prontos nas fases 13 e 14 — quando você pedir, adiciono os secrets necessários e implemento.

## Domínio próprio
Conectado depois do MVP funcional, via configurações de Publish do Lovable.

---

**Confirma que posso começar pela Fase 1 (Design System + identidade visual)?** Em seguida sigo direto para Fase 2 (schema núcleo) já preparando a migration para sua aprovação.
