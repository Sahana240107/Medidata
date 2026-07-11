# MediData

**Privacy-Preserving Global Medical Discovery Network**

MediData connects hospitals worldwide through irreversible medical fingerprints — enabling rare disease detection, research collaboration, and expert matching without a single patient record leaving your institution.

---

## What it does

- **Case matching** — Upload an unusual case, instantly receive similar cases from hospitals globally
- **Research signal discovery** — AI continuously clusters fingerprints to surface emerging syndromes and drug response patterns
- **Expert network** — Find verified specialists who've managed similar presentations
- **Hospital reputation** — Discovery scores and global rankings create real incentives to contribute

Patient data **never** leaves your hospital. Only mathematical embeddings are shared.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, Zustand, Tailwind CSS |
| Backend | FastAPI, Python 3.11+ |
| Database | Supabase (PostgreSQL) |
| Vector DB | Qdrant |
| Auth | Supabase Auth + JWT |
| ML | sentence-transformers, scikit-learn |

---

## Project structure

```
Medidata-main/
├── frontend/          # Next.js app
│   ├── app/           # Pages and layouts (App Router)
│   │   ├── page.jsx               # Landing page
│   │   ├── (auth)/login/          # Login
│   │   ├── (auth)/signup/         # Signup (2-step)
│   │   └── (dashboard)/           # Protected dashboard pages
│   ├── components/    # Shared UI components
│   ├── lib/
│   │   ├── api/       # API client functions
│   │   ├── hooks/     # React hooks (useAuth, useChat, etc.)
│   │   └── supabase/  # Supabase browser/server/middleware clients
│   ├── store/         # Zustand stores (auth, UI)
│   └── middleware.ts  # Route protection
│
├── backend/           # FastAPI app
│   ├── app/
│   │   ├── main.py          # Entry point, CORS, router registration
│   │   ├── routers/         # auth, cases, chat, research, ...
│   │   ├── models/          # Pydantic models
│   │   ├── db/              # Supabase + Qdrant clients
│   │   ├── agents/          # Discovery + research chat agents
│   │   └── ml/              # Embedder, vectorizer, clustering
│   ├── alembic/             # DB migrations
│   └── requirements.txt
│
└── README.md
```

---

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Supabase](https://supabase.com) project with the schema applied

### 1. Apply the database schema

Run the SQL from `supabase/schema.sql` (or the schema in the repo docs) in your Supabase SQL editor.

Then add the hospital uniqueness constraint:

```sql
ALTER TABLE hospitals
ADD CONSTRAINT hospitals_name_country_key UNIQUE (name, country);
```

### 2. Backend

```bash
cd backend

python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env — fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

uvicorn app.main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend

npm install

cp .env.example .env.local
# Edit .env.local — fill in NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

npm run dev
```

App runs at `http://localhost:3000`

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, never expose) |
| `ENVIRONMENT` | `development` or `production` |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL (e.g. `http://localhost:8000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

---

## Auth flow

1. User fills the 2-step signup form (role → credentials → institution details)
2. Frontend POSTs to `POST /auth/register`
3. Backend creates a Supabase Auth user, upserts the hospital row, inserts the profile
4. Returns a JWT — stored in a cookie (for middleware) and Zustand (for components)
5. `middleware.ts` enforces route protection on every navigation

---

## Current status

- [x] Landing page with animations
- [x] Login / Signup with JWT auth
- [x] Database schema (profiles, hospitals, cases, signals, graph)
- [ ] Case submission flow
- [ ] Discovery agent
- [ ] Research signals feed
- [ ] Expert search
- [ ] AI chat