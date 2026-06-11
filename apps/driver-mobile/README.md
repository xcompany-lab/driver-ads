# Driver Ads Motorista Mobile

App Expo do motorista para cadastro, auditoria, campanhas, Pix, provas de instalacao e tracking operacional nativo.

## Escopo V1

- Cadastro e login de motorista usando a Edge Function `public-signup`.
- Perfil, avatar, documentos de identidade, CRLV e veiculos.
- Marketplace de campanhas disponiveis, convites e vinculos.
- Foto de instalacao por campanha.
- Chave Pix de recebimento e historico de repasses.
- Sessao manual de tracking com background location nativo.

## Env

Crie `apps/driver-mobile/.env` a partir de `.env.example` ou configure as variaveis no EAS:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

## Rodar

```bash
cd apps/driver-mobile
npm install
npm run start
```

Background location exige development build/native build. Expo Go nao cobre o fluxo completo de localizacao em segundo plano.

## Validacao

```bash
npm run typecheck
```

## Builds EAS

```bash
npm install -g eas-cli
eas login
eas build:configure
npm run build:android:preview
npm run build:android:production
npm run build:ios:production
```

## Publicacao

Antes de enviar para Play Store/App Store:

- Configurar as mesmas envs no EAS com `eas secret:create`.
- Definir icon, adaptive icon e splash finais em `app.json`.
- Criar politica de privacidade publica com uso de localizacao em background, documentos, fotos e finalidade LGPD.
- Preencher Data Safety no Google Play e App Privacy no App Store Connect.
- Criar contas Apple Developer e Google Play Console, certificados/perfis e service account de submit.
- Testar em build nativo real: cadastro, login, upload de documentos, candidatura, prova de instalacao, Pix e tracking em segundo plano.
