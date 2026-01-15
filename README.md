# CampVibe

CampVibe is a modern Next.js app for discovering and booking camp sites, with a Host dashboard for managing listings, bookings, and team members.

## Tech Stack

- Next.js (App Router) + React
- Prisma + PostgreSQL
- Tailwind CSS + shadcn/ui (Radix)
- Auth.js / NextAuth (Credentials)

## Local Development

1) Install deps

```bash
npm install
```

2) Create env file

Copy `env.example` → `.env` and fill values.

Required:
- `AUTH_SECRET`
- `DATABASE_URL` (PostgreSQL)

3) Prisma

```bash
npx prisma generate
npx prisma migrate deploy
```

4) Run dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
npm run start
```

## Deploy (Vercel)

1) Push this repo to GitHub
2) Import project in Vercel
3) Set Environment Variables (same as `.env`)
4) Add a Postgres database (Vercel Postgres / Neon / Supabase)
5) Deploy

Notes:
- `npm run build` runs `prisma generate` before `next build`
- Run migrations in your deploy pipeline (`prisma migrate deploy`)
