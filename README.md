# ⚡ JARVIS — Task Manager

A dark-themed, mobile-first productivity app you install on your phone. Two goals: work on what matters most, and never lose track of anything.

## Features
Six tabs. Each has a box to type in; the 🎙 in the box lets you speak instead.

- **Add a task** (top of Today): "On 21st call the DEO and send the survey report, also book train tickets tomorrow" → three tasks, each on its day. Understands today, tomorrow, Friday, 15 Oct, on 21st, in 3 days, next week/month; "every day" makes a Tracker habit. Undo is one tap.
- **Repeating tasks**: "Every Monday submit report", "pay rent on the 1st of every month", "every 3 days". Tick one and the next is added (shown as ↻ on the task).
- **Follow-ups**: "Waiting for Collector's reply" comes back in 3 days (⏳) unless you give a day.
- **☀️ Today**: the card at the top shows the one thing to do **next** (Done / Later); the rest of today is below. Tap ☆ to highlight the important ones, which stay at the top. Tick a task when it is done.
  - Anything not ticked off by midnight **moves to the next day automatically**, marked "↪ N days" so you can see what keeps slipping.
  - The day card shows how many of today's tasks you finished.
  - After 8 pm an **evening wrap-up** lists what's left: done, tomorrow or drop, or all to tomorrow in one tap.
- **Works offline**: Jarvis opens with no signal; tasks you add or tick wait on the phone and sync when you're back online.
- **🔁 Tracker**: habits you want to keep up every day or a few times a week (gym, walk, reading). Tick today with one tap, see this week and this month at a glance (e.g. "Gym 3/4 this week · 11/17 this month"), and open the month calendar to fill in past days.
- **🔍 Search**: the latest Google News headlines (India) and a Wikipedia summary, right in the app, free with no key. With the free Gemini key (below) a short answer written from them appears on top. **Google ↗** opens the full Google search.
- **💬 Assist**: chat like ChatGPT or Gemini. It knows today's tasks, plans your day, writes and polishes letters and messages (send by WhatsApp, SMS or email in one tap), turns what you say into tasks (+ Add) and dials numbers. Needs the free Gemini key; without it the question opens in ChatGPT or Claude. The chat stays on the phone until **New chat** or sign-out.
- **✨ Evolve**: tell Jarvis what it should do better ("show a weekly summary every Sunday"). Claude builds it every morning; it shows here under **Ready to try** with **Try it**, **Approve** (puts it live), **Change** and **Drop**. Also lists what is being built and what was added lately. The number on the tab is how many are waiting for you.
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

## Security checklist (one time)
- GitHub repo → Settings → **Change visibility → Private**. The old Supabase key is still in the repo's history, so also make a new key: Supabase → Project Settings → API → regenerate the anon key, and put the new one in Netlify (`VITE_SUPABASE_ANON_KEY`).
- Supabase → Authentication → Sign In / Providers → turn off **Allow new users to sign up**, once your own account exists.
- Turn on two-step login for GitHub and Netlify.
- Already built in: each account sees only its own tasks; only `JARVIS_OWNER_EMAIL` can use the server functions; security headers in `netlify.toml` stop other sites embedding or injecting into Jarvis; the copy of tasks on the phone is cleared on sign-out.

## Switch on the extras (optional, free, one time)
All keys go in one place: Netlify → your site → **Site configuration → Environment variables → Add a variable**. They stay on the server, never on the phone. Redeploy once afterwards (Deploys → Trigger deploy).

| Variable | What it switches on | Where to get it |
|---|---|---|
| `JARVIS_OWNER_EMAIL` | Only your account can use the two below | Your Jarvis login email |
| `GEMINI_API_KEY` | Assist chats inside Jarvis; Search adds a short answer on top of the headlines | https://aistudio.google.com/apikey → **Create API key** (free, no card). Google's free tier has daily limits and may use what you send to improve its products, so don't send confidential office details. |
| `GITHUB_TOKEN` | Evolve sends requests straight to Claude and shows what Claude built for you to try, approve (puts it live), change or drop | GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate. Repository access: only `jarvis`. Permissions: Contents, Issues, Pull requests = Read and write. |

Optional: `GEMINI_MODEL` picks another Gemini model (default `gemini-flash-latest`). Gemini's free tier can't search Google itself, so the Search tab fetches Google News and Wikipedia first and hands them to Gemini.

### How Jarvis learns
- Tasks you add on several days show up as one-tap suggestions when you tap the Add a task box.
- Bigger changes come from you, in the ✨ Evolve tab. Claude builds them every morning; they appear there to try, and **Approve** puts one live.

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
