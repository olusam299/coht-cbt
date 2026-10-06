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
