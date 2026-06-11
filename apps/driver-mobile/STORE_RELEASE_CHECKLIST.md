# Driver Ads Motorista - Store Release Checklist

## Identidade

- App name: Driver Ads Motorista
- Bundle ID iOS: `br.com.driverads.motorista`
- Package Android: `br.com.driverads.motorista`
- Categoria sugerida: Business / Negocios
- Icone final: PNG 1024x1024, sem transparencia para iOS.
- Adaptive icon Android: foreground/background separados.
- Splash screen final com logo Driver Ads.

## Privacidade

- Publicar URL de politica de privacidade antes do submit.
- Declarar coleta de:
  - Localizacao aproximada e precisa.
  - Fotos/documentos enviados pelo motorista.
  - Dados de contato e identificacao.
  - Identificadores de conta Supabase.
- Explicar finalidade:
  - Validacao cadastral.
  - Auditoria de campanhas.
  - Analytics operacional agregado.
  - Repasse financeiro.
- Deixar claro que anunciante nao acessa trilha exata do motorista.

## Google Play

- Preencher Data Safety.
- Justificar permissao `ACCESS_BACKGROUND_LOCATION`.
- Enviar video curto mostrando o fluxo: motorista inicia sessao de rastreamento para campanha ativa.
- Build de producao deve ser AAB: `npm run build:android:production`.

## App Store

- Preencher App Privacy.
- Justificar `Always and When In Use Location`.
- Validar que o app mostra consentimento claro antes de iniciar tracking.
- Build de producao: `npm run build:ios:production`.

## QA obrigatorio antes de submit

- Criar conta de motorista.
- Login/logout.
- Atualizar perfil e avatar.
- Enviar CNH, selfie, comprovante e CRLV.
- Cadastrar veiculo.
- Ver campanha disponivel e se candidatar.
- Aceitar convite.
- Enviar foto de instalacao.
- Cadastrar chave Pix.
- Iniciar e encerrar tracking em build nativo real.
- Confirmar chegada de pontos em `driver_location_points`.
