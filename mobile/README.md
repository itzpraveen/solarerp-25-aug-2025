# SolarERP Flutter Mobile

This module is a native Flutter Android client for SolarERP.

It uses:
- Supabase Auth (`signInWithPassword`)
- Supabase Postgres with existing RLS policies
- Existing backend route `POST /api/auth/ensureProfile` for invite/self-signup checks

Current native screens:
- Sign in
- Overview KPIs (from RPC `overview_kpis_agg`)
- Leads list
- Account/profile

## Prerequisites

- Flutter SDK installed (`flutter --version`)
- Android Studio + Android SDK
- A Supabase project connected to this repo's schema/migrations
- A deployed HTTPS URL of this Next.js app (for `API_BASE_URL`)

## Run On Android (Debug)

```bash
cd mobile
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://<project-ref>.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<anon-key> \
  --dart-define=API_BASE_URL=https://<your-web-domain> \
  --dart-define=AUTH_USERNAME_DOMAIN=erp.renewg.in
```

If `AUTH_USERNAME_DOMAIN` is omitted, it defaults to `erp.renewg.in`.

## Build Release APK

```bash
cd mobile
flutter build apk --release
```

Output APK:

- `mobile/build/app/outputs/flutter-apk/app-release.apk`

## Build App Bundle (Play Store)

```bash
cd mobile
flutter build appbundle --release
```

Output AAB:

- `mobile/build/app/outputs/bundle/release/app-release.aab`

## Notes

- Required dart defines:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `API_BASE_URL` (points to the deployed Next.js app for `/api/auth/ensureProfile`)
- Username login follows the same rule as web:
  - `username` becomes `username@AUTH_USERNAME_DOMAIN`
- The app is native Flutter UI, not a WebView wrapper.
