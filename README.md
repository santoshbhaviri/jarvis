# ⚡ JARVIS — Task Manager

A dark-themed, mobile-first productivity app you install on your phone. Two goals: work on what matters most, and never lose track of anything.

## Features
Three tabs, kept simple:

- **🎙️ Jarvis button** (bottom right, on every screen): tap and speak or type. Jarvis works out what you meant:
  - **Tasks**: "On 21st call the DEO and send the survey report, also book train tickets tomorrow" → three tasks, each on its day. Understands today, tomorrow, Friday, 15 Oct, on 21st, in 3 days, next week/month; "every day" makes a Tracker habit. Undo is one tap.
  - **Questions**: "Latest news on Rythu Bharosa", "Polish this: …" → free answers from Google's AI Mode (or ChatGPT / Claude), or inside Jarvis once the free Gemini key is added (below).
  - **App changes**: "Jarvis should show a weekly summary" → a request on GitHub; Claude builds it and sends a preview to approve.
- **☀️ Today**: the things you plan to do today. Tap ☆ to highlight the important ones, which stay at the top. Tick a task when it is done.
  - Anything not ticked off by midnight **moves to the next day automatically**, marked "↪ N days" so you can see what keeps slipping.
  - The day card shows how many of today's tasks you finished.
- **🔁 Tracker**: habits you want to keep up every day or a few times a week (gym, walk, reading). Tick today with one tap, see this week and this month at a glance (e.g. "Gym 3/4 this week · 11/17 this month"), and open the month calendar to fill in past days.
- **✅ Done**: everything you finished, grouped by day. Tasks stay here for **30 days** and are then deleted automatically. Tap ↩ Restore to bring one back to today.
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
Android: open the Netlify URL in Chrome and tap **Install** on the card. iPhone: it must be **Safari** (not Chrome or a link opened inside WhatsApp/Gmail): Share (on iOS 26: ••• → Share) → **Add to Home Screen** → keep *Open as Web App* on → **Add**. The card on the sign-in and Today screens shows these steps. Then tap 🔔 inside the app to allow reminders.

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

## Switch on the extras (optional, free, one time)
All keys go in one place: Netlify → your site → **Site configuration → Environment variables → Add a variable**. They stay on the server, never on the phone. Redeploy once afterwards (Deploys → Trigger deploy).

| Variable | What it switches on | Where to get it |
|---|---|---|
| `JARVIS_OWNER_EMAIL` | Only your account can use the two below | Your Jarvis login email |
| `GEMINI_API_KEY` | Answers appear inside Jarvis | https://aistudio.google.com/apikey → **Create API key** (free, no card). Google's free tier has daily limits and may use what you send to improve its products, so don't send confidential office details. |
| `GITHUB_TOKEN` | App requests go straight from Jarvis to Claude, and ✨ Updates shows what Claude built for you to try, change or drop | GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate. Repository access: only `jarvis`. Permissions: Contents, Issues, Pull requests = Read and write. |

Optional: `GEMINI_MODEL` picks another Gemini model (default `gemini-flash-latest`). Gemini's free tier can't search the web, so live news still goes to Google.

### How Jarvis learns
- When you correct Jarvis (tap Task / Ask / Improve app yourself), it remembers how that sentence started and gets it right next time.
- Tasks you add on several days show up as one-tap suggestions when you open the Jarvis button.
- Bigger changes come from you: say "Jarvis should …". Claude builds it every morning; it appears under ✨ Updates to try. Putting it live is a **Merge** tap on GitHub.

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
