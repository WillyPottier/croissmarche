# Croiss'Marche — PRD

## Problem statement
Mobile-first (390px) FRENCH web app. Users earn "Croissants Coins" (CC) by walking and spend 60 CC on vouchers ("contremarques") redeemable at partner bakeries: one free pastry for any purchase of 2,50 € or more. Partners pay 49 €/month + 1 € per validated voucher. Three roles: walkers, partners, admin.

## Architecture
- **Backend**: FastAPI + MongoDB (motor, tz_aware). All CC/voucher logic server-side in `engine.py` (pure + db-bound functions taking an explicit `db` handle for testability). Constants in `config.py`. Idempotent seed in `seed.py`. Auth: JWT custom (bcrypt + PyJWT), role-based (walker/partner/admin).
- **Frontend**: Expo Router (React Native Web), route groups `(auth) (walker) (partner) (admin)`, each role gated by `RoleGate` with its own entry point and bottom tabs. React Query for data. Fonts: Fraunces (display) + Inter (UI) via expo-font. Theme tokens in `src/theme.ts`. Strict fr-FR formatting in `src/format.ts`.
- **Data model**: users, step_entries, cc_lots (FIFO expiry ledger), partners, vouchers, redemptions, partner_invoices (computed), notifications (stub).

## Earning engine (verified)
- FREE 1 CC / 1000 steps, PREMIUM 2 CC / 1000 steps, floored AFTER multiplying (PREMIUM 6500 = 13 CC).
- Per-day recompute never double-credits (delta applied to that day's lot).
- Daily cap 20 000 steps. CC expire 6 months FIFO. Onboarding imports last 7 days.

## Voucher/redemption (verified)
- 60 CC debited at creation (atomic; partial unique index = one ACTIVE per user). 4-digit code, 10-min TTL.
- Creation refused outside partner off-peak window (never waste 60 CC).
- Server-side validation: wrong code / wrong partner / already redeemed / expired / off-peak → refused with FR reason. Success creates a Redemption billed 100 cents; isNewCustomer computed.

## Roles
- **Walker** tabs: Accueil (big CC balance + progress + partner list + static mini-map), Ma contremarque (code + countdown), Historique, Profil (Premium upsell — instant PREMIUM toggle, payment stubbed behind flag OFF; RGPD export + account deletion + logout).
- **Partner** tabs: Validation (fullscreen numeric keypad + green success overlay), Stats (new vs returning headline + revenue), Réglages (off-peak, reward, pause), Facturation.
- **Admin** tabs: Tableau de bord (global metrics), Partenaires (CRUD + 500 m exclusivity with force), Marcheurs (list), Dev (set steps / backfill / toggle plan / age CC / run daily notifications).

## Implemented (2026-06)
- Full 3-role app, seeded (1 admin, 6 Perpignan bakeries + logins, 20 walkers with 7-day history).
- All 11 mandatory earning/redemption test cases pass (`backend/tests/test_engine.py`) + 26 API integration tests.
- Frontend verified on Expo web at 390px, strict fr-FR localization, no euro value for CC.
- Feature flag PAYMENTS_ENABLED=false; notification sender stubbed.

## Test accounts (password croissant123)
- admin@croissmarche.fr · marie@croissmarche.fr (walker) · contact@castillet.fr (partner, bakery open 07:00–21:00 every day for demos).

## Backlog
- P1: Real HealthKit / Health Connect via `NativeStepSource` (stub ready; native build required).
- P1: Real payment provider for Premium behind the flag.
- P2: Hide PAUSED partners from admin per-partner breakdown; monthly PartnerInvoice generation job.
- P2: True daily notification sender (push) — native build required.
