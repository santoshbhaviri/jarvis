# ⚡ JARVIS — Task Manager

A dark-themed, mobile-first productivity app you install on your phone. Two goals: work on what matters most, and never lose track of anything.

## Features
Three tabs, kept simple:

- **☀️ Today**: the things you plan to do today. Add a task by speaking (🎙️) or typing at the top; say a day ("call DEO Friday") to plan it for later. Tap ☆ to highlight the important ones, which stay at the top. Tick a task when it is done.
  - Anything not ticked off by midnight **moves to the next day automatically**, marked "Carried over · N days" so you can see what keeps slipping.
  - The day card shows how many of today's tasks you finished.
- **🔁 Tracker**: habits you want to keep up every day or a few times a week (gym, walk, reading). Tick today with one tap, see this week and this month at a glance (e.g. "Gym 3/4 this week · 11/17 this month"), and open the month calendar to fill in past days.
- **✅ Done**: everything you finished, grouped by day. Tasks stay here for **30 days** and are then deleted automatically. Tap ↩ Restore to bring one back to today.
- **✨ Ask**: speak or type to Claude. Ask questions (it searches the web when needed), have a message polished and send it by WhatsApp, SMS or email, or say what's on your mind and add the tasks it picks out. 🔊 reads an answer aloud. With no setup, questions open in the Claude app with today's tasks attached (free with a Claude account); with the optional setup below, answers come back inside Jarvis.
- **Reminders**: 🔔 in the header turns on a morning summary notification (today's tasks, important ones, carried over).
- **Login**: each account sees only its own tasks.

## Setup

### 1. Install
```bash
npm install
```

### 2. Supabase
- Create project at supabase.com
- Run `supabase-schema.sql` in SQL Editor
- Run `supabase-schema-update.sql`, then `supabase-schema-v3.sql` (safe to re-run; run it again whenever it changes, e.g. for the habit goal column)
- Copy Project URL and anon key
- Open the app, create your account and confirm the email
- Claim your existing tasks: run the `update public.tasks set user_id = …` statement at the bottom of `supabase-schema-v3.sql` with your email
- Optional: in Authentication → Providers → Email, turn off "Allow new users to sign up" once your account exists

### Upgrading from v2
`supabase-schema-v3.sql` replaces the old "allow everyone" database policies, so tasks are only visible after signing in. The old `.env` was committed to this public repo: **rotate the anon key** in Supabase (Settings → API) and put the new one in your local `.env` and in Netlify's environment variables.

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

### 6. Install on your phone
Open the Netlify URL in Chrome (Android) or Safari (iPhone) → menu → **Add to Home Screen**. Then tap 🔔 inside the app to allow reminders.

## Reminders
- **While the app is open** (or was opened recently): after 7 am, JARVIS shows the day's summary once a day. Works with no extra setup.
- **Even when the app is closed** (push), one-time setup:
  1. `npx web-push generate-vapid-keys`
  2. Put the public key in `.env` and Netlify as `VITE_VAPID_PUBLIC_KEY`, then redeploy
  3. Install the Supabase CLI, then:
     ```bash
     supabase link --project-ref <your-project-ref>
     supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:<your email> CRON_SECRET=<any long random text>
     supabase functions deploy send-reminders --no-verify-jwt
     ```
  4. In the SQL Editor, schedule it every 15 minutes (Database → Extensions: enable `pg_cron` and `pg_net` first):
     ```sql
     select cron.schedule('jarvis-reminders', '*/15 * * * *', $$
       select net.http_post(
         url     := 'https://<your-project-ref>.supabase.co/functions/v1/send-reminders',
         headers := '{"x-cron-secret": "<same CRON_SECRET>"}'::jsonb
       )
     $$);
     ```
  5. Open the app on your phone and tap 🔔. The summary arrives at 08:00 your time (change `remind_at` in `push_subscriptions` for another time).

## Ask Jarvis inside the app (optional)
Ask Jarvis calls Claude from a Supabase Edge Function, so your API key stays on the server and never reaches the phone.
1. Create an API key at https://console.anthropic.com (Settings → API keys) and add a little credit under Billing. It is pay-per-use.
2. Install the Supabase CLI, then:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase secrets set ANTHROPIC_API_KEY=<your key>
   supabase functions deploy ask-jarvis
   ```
   (Without the CLI: Supabase dashboard → Edge Functions → Deploy a new function named `ask-jarvis`, paste `supabase/functions/ask-jarvis/index.ts`, then add `ANTHROPIC_API_KEY` under Edge Functions → Secrets.)
3. Open the ✨ Ask tab. Only signed-in users can use it.

Jarvis can open WhatsApp, SMS, email or the dialer with the text ready, but you always tap Send yourself; it cannot operate other apps or phone settings.

## Structure
```
src/
  components/   # One .jsx + .module.css per component
  hooks/        # useTasks.js — all DB logic; useAuth, useReminders
  lib/          # constants, dateUtils, supabase client, parseTask (plain words → task)
  styles/       # global.css with CSS variables
```

## Customise
| What | Where |
|------|-------|
| Tab names / icons | `src/lib/constants.js` |
| Days kept in Done | `BIN_DAYS` in `src/hooks/useTasks.js` |
| Colors / fonts | `src/styles/global.css` |
| DB queries | `src/hooks/useTasks.js` |
| Add a new tab | `src/App.jsx` + new page component |
