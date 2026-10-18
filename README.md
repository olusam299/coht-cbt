# COHT CBT — Frontend

Computer-based testing portal for the College of Health Technology. Student, Admin and SuperAdmin interfaces.

**Stack:** TanStack Start (React 19, Vite), TypeScript, Tailwind v4, shadcn/ui, TanStack Query, Supabase JS.
**Backend:** the `cbtmobile-coht` repo (Supabase: Postgres, RLS, RPCs, edge functions). All scoring, timing and authorization live there; this app only calls RPCs.

## Run

```sh
npm i
cp .env.example .env   # set the two variables below
npm run dev
```

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |

## Layout

- `src/routes/` file-based routes: `/` (student), `/exam/$attemptId`, `/admin/*`, `/superadmin/*`, `/auth`, `/onboarding`
- `src/services/` Supabase service layer (`index.ts` plus `academic`, `data-management`, `exam-management`, `question-bank`, `student-otp`)
- `src/components/` exam, admin, student and layout components; `ui/` holds only the shadcn primitives in use
- `src/hooks/`, `src/lib/` exam timer, security hook, shared types

## Student login

Registration number plus a one-time password issued by a SuperAdmin.

## Checks

```sh
npx tsc --noEmit
npm run lint
npm run build
```

Synced with Lovable; avoid rewriting pushed git history.

## HTTPS

Sign-in and exams must run over HTTPS. The app enforces this:

- `VITE_SUPABASE_URL` must be an `https://` address (the app refuses to start otherwise).
- A production page opened over plain `http://` is redirected to `https://`, and sign-in is withheld until it is.
- Every response carries HSTS, `upgrade-insecure-requests`, `nosniff` and anti-framing headers.

**Production:** deploy to Cloudflare (the build target) or publish from Lovable. Both serve HTTPS automatically.

**Testing on a phone:** the dev server on a network address (`http://192.168.x.x:8081`) is plain http and shows a "not served over HTTPS" banner. For a real HTTPS test, open a tunnel to it:

```powershell
winget install Cloudflare.cloudflared
npm run dev
cloudflared tunnel --url http://localhost:8081
```

Open the `https://….trycloudflare.com` address it prints on the phone.

## Deploying

```powershell
npm i -g wrangler
wrangler login
npm run deploy
```

`npm run deploy` builds the app and publishes it to Cloudflare as `coht-cbt` (the address is `https://coht-cbt.<your-subdomain>.workers.dev`). Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a git-ignored `.env.production` file first. To use a different name, change `--name` in the `deploy` script.
