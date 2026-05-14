# ⚡ TaskFlow

A mobile-first productivity task tracker built with **React + Vite**, backed by **Supabase**, and deployed on **Netlify**.

---

## 🗂 Project Structure

```
taskflow/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/          # UI components (each has .jsx + .module.css)
│   │   ├── AlertBanner.*
│   │   ├── BulkAddModal.*   # Bulk add: table on desktop, cards on mobile
│   │   ├── EditTaskModal.*
│   │   ├── FilterBar.*
│   │   ├── Header.*
│   │   ├── StatsBar.*
│   │   ├── TabBar.*
│   │   ├── TaskCard.*
│   │   └── TaskList.*
│   ├── hooks/
│   │   ├── useFilters.js    # Filter + tab state logic
│   │   └── useTasks.js      # All Supabase CRUD operations
│   ├── lib/
│   │   ├── constants.js     # Priorities, categories, statuses — edit here
│   │   ├── dateUtils.js     # Date helpers
│   │   └── supabase.js      # Supabase client
│   ├── pages/
│   │   └── Dashboard.*      # Main page — composes all components
│   ├── styles/
│   │   └── global.css       # CSS variables / design tokens
│   ├── App.jsx
│   └── main.jsx
├── .env.example
├── .gitignore
├── index.html
├── netlify.toml
├── package.json
├── supabase-schema.sql      # Run this in Supabase SQL editor
└── vite.config.js
```

---

## 🚀 Setup Guide

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/taskflow.git
cd taskflow
npm install
```

---

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In your project, open **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Settings → API** and copy:
   - **Project URL**  (looks like `https://xxxx.supabase.co`)
   - **anon/public key**

---

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

### 5. Deploy to Netlify

#### Option A — Netlify UI (recommended)

1. Push your repo to GitHub
2. Go to [netlify.com](https://netlify.com) → **Add new site → Import from Git**
3. Select your GitHub repo
4. Build settings are auto-detected from `netlify.toml`
5. In **Site Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy!

#### Option B — Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify env:set VITE_SUPABASE_URL "https://xxxx.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "your-key"
netlify deploy --prod
```

---

## 🛠 Customisation

| What to change | Where |
|---|---|
| Add a new category / priority / status | `src/lib/constants.js` |
| Change colors / fonts | `src/styles/global.css` (CSS variables) |
| Add a new page / route | `src/App.jsx` + new file in `src/pages/` |
| Change DB queries | `src/hooks/useTasks.js` |
| Add DB columns | `supabase-schema.sql` + update `useTasks.js` |

---

## 📦 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| Database | Supabase (PostgreSQL) |
| Styling | CSS Modules + CSS Variables |
| Toasts | react-hot-toast |
| Dates | date-fns |
| Hosting | Netlify |
| Fonts | Syne + DM Sans (Google Fonts) |
