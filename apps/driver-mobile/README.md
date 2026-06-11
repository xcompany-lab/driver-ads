# Driver Ads Motorista Mobile

App Expo para tracking operacional nativo do motorista.

## Env

Crie `apps/driver-mobile/.env` ou configure no ambiente:

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
