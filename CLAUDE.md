@AGENTS.md

# Brighton Lawn + Landscape

Professional landscaping company management app built with Expo (React Native + web), Supabase, and Cloudflare R2.

## Stack
- **Framework**: Expo SDK 57, React Native 0.86, expo-router (file-based routing)
- **Platforms**: iOS, Android, Web
- **Auth & DB**: Supabase (auth + Postgres + Row Level Security)
- **Storage**: Cloudflare R2 (S3-compatible, presigned URL pattern)
- **Animation**: react-native-reanimated
- **Icons**: @expo/vector-icons (Feather set)

## Project Structure
- `app/` — expo-router file-based routing
  - `(auth)/` — Login, signup (unauthenticated)
  - `(owner)/` — Owner/admin tab navigation (5 tabs)
  - `(worker)/` — Worker tab navigation (3 tabs, mobile-first)
  - `(customer)/` — Customer tab navigation (3 tabs, polished/simple)
- `src/theme/` — Design system tokens (colors, typography, spacing, shadows)
- `src/components/ui/` — Reusable UI components (Button, Input, Card, etc.)
- `src/components/layout/` — Layout components (ScreenContainer)
- `src/components/branding/` — Logo/splash components
- `src/providers/` — React context providers (Auth, Theme)
- `src/lib/` — Supabase client, Cloudflare R2 storage utilities
- `src/types/` — TypeScript type definitions
- `supabase/migrations/` — Database migration SQL files

## Commands
- `npm start` — Start Expo dev server
- `npm run web` — Start for web
- `npm run ios` — Start for iOS
- `npm run android` — Start for Android

## Branding
- **Company**: Brighton Lawn + Landscape
- **Primary green**: `#7CB342` (fresh leaf green from the icon mark)
- **Accent dark**: `#1B3A2D` (deep forest green from the wordmark)
- **Two logos**: `logo-full.png` (wordmark) and `logo-icon.png` (leaf mark)
- Lean toward the lighter green — keep the UI clean and approachable

## Roles
Three user roles: `owner`, `worker`, `customer`. Auth routing in `app/_layout.tsx` redirects to the correct group based on role.

## Design System
Import from `@/theme`. Brand colors derived from the Brighton logos in `src/theme/colors.ts`.

## Important Notes
- Path alias: `@/` maps to `src/`
- Supabase credentials go in `.env` (see `.env.example`)
- Logo files go in `assets/images/logo-full.png` and `assets/images/logo-icon.png`
