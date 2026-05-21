# ⚡ JARVIS — Task Manager

A dark-themed, mobile-first productivity app with 4 tabs: Routine, Scut-Work, Mission, Task Master.

## Features
- **Routine** tab: 7-day week tracker per task
- **Scut-Work** tab: Pending / Completed / Scheduled sections
- **Mission** tab: Sorted by deadline, with extend option
- **Task Master** tab: Add & delete all tasks centrally
- Work / Personal / All radio filter on each tab
- Extend tasks to a new date (scut-work & mission)
- Edit notes inline per task
- Completed tasks section per tab, cleared daily
- Persistent storage via Supabase

## Setup

### 1. Install
```bash
npm install
```

### 2. Supabase
- Create project at supabase.com
- Run `supabase-schema.sql` in SQL Editor
- Copy Project URL and anon key

### 3. Environment
```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 4. Run locally
```bash
./node_modules/.bin/vite        # Git Bash
npm run dev                      # cmd / PowerShell
```

### 5. Build & deploy
```bash
./node_modules/.bin/vite build  # creates dist/
# Drag dist/ to app.netlify.com/drop
# Add env vars in Netlify site settings
```

## Structure
```
src/
  components/   # One .jsx + .module.css per component
  hooks/        # useTasks.js — all DB logic
  lib/          # constants, dateUtils, supabase client
  styles/       # global.css with CSS variables
```

## Customise
| What | Where |
|------|-------|
| Tab names / icons | `src/lib/constants.js` |
| Colors / fonts | `src/styles/global.css` |
| DB queries | `src/hooks/useTasks.js` |
| Add a new tab | `src/App.jsx` + new page component |
