# ⚡ JARVIS — Task Manager

A dark-themed, mobile-first productivity app you install on your phone. Two goals: work on what matters most, and never lose track of anything.

## Features
- **Quick capture**: speak (🎙️) or type a task in plain words at the top of every tab. "Follow up with DEO on survey by Friday !" becomes a Mission due Friday, marked Important, with a follow-up on DEO
- **Today** tab: Top 3 focus tasks (☆), follow-ups to make, overdue, due today, routines left
- **Priorities** tab: Eisenhower grid (Do now / Schedule / Delegate / Drop) from the Important and Urgent flags
- **Follow-ups**: "Follow up with" a person or office plus a date; tap 📞 after chasing and it comes back in 2 days
- **Insights** tab: tasks finished per week, share of important work, routine consistency, tasks that keep getting postponed, and a weekly review
- **Reminders**: 🔔 in the header turns on a morning summary notification
- **Login**: each account sees only its own tasks
- Edit any task with ⚙︎ (title, status, dates, priority, follow-up, notes)
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
- Run `supabase-schema-update.sql`, then `supabase-schema-v3.sql`
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
| Colors / fonts | `src/styles/global.css` |
| DB queries | `src/hooks/useTasks.js` |
| Add a new tab | `src/App.jsx` + new page component |
