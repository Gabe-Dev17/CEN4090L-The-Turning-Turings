# Plateful – Calorie Tracker (The Turning Turings, CEN4090L)

A web food journal: log meals and snacks with portions, get calories worked out automatically, record mood, location and activity, and see a daily total. React + Vite + Tailwind CSS frontend with an Express + SQLite backend.

## Requirements

- Node.js 22.13 or newer (`node -v` to check). The backend uses Node's built-in SQLite, which needs no extra flag from 22.13 on.

## Setup

From the project folder:

```bash
npm run setup     # same as: npm install && npm install --prefix server
```

Optional: copy `server/.env.example` to `server/.env` to set your own settings. Without it the app still runs with local foods only. Put your USDA key in `FDC_API_KEY` to turn on USDA food search. `.env` is in `.gitignore`, so it never gets committed.

## Running

Open two terminals.

Terminal 1 (backend, http://localhost:3001):

```bash
npm run server
```

Terminal 2 (frontend, http://localhost:5173):

```bash
npm run dev
```

Keep both terminals running. Leave `PORT` at 3001 in `server/.env` (or leave it out), because the frontend sends `/api` requests to port 3001.

Go to http://localhost:5173. The frontend sends `/api` requests to the backend through the Vite proxy. If you're not logged in you're sent to the login page (`/login/index.html`). Creating an account there switches to the Log in tab with your email filled in, and logging in goes to Home.

To run it as one server instead: `npm run build`, then `npm start`, and open http://localhost:3001.

The database is created at `server/data.db` the first time the server starts. It's in `.gitignore`. Delete it to start fresh.

On Windows, if PowerShell says `npm.ps1 cannot be loaded because running scripts is disabled`, run the commands in Command Prompt instead (in WebStorm: Settings > Tools > Terminal > Shell path `cmd.exe`). On a work or school computer that blocks npm, use GitHub Codespaces (below).

## Scripts

| Command | What it does |
|---|---|
| `npm run setup` | installs everything (frontend and server) |
| `npm run server` | starts the backend on :3001, restarting when a server file changes |
| `npm run dev` | starts the frontend on :5173 |
| `npm test` | runs the 33 server tests against a fresh in-memory database (they never call the real USDA API) |
| `npm run test:e2e` | builds the frontend and runs the 98 browser tests |
| `npm run test:e2e:report` | opens the report from the last browser test run |
| `npm run lint` | runs ESLint on the whole project |
| `npm run build` | builds the frontend into `dist` |
| `npm start` | runs the backend, which also serves the built frontend on :3001 |

## Login

The login page is a plain HTML/JS page in `public/login/` (not part of React), so Vite and Express serve it as is. Link to it as `/login/index.html`, not `/login/`: in dev, Vite sends `/login/` to the React app.

Logging in gives the browser a token, which `public/login/auth.js` keeps in localStorage and the React app (`src/api.js`) sends with every request (`Authorization: Bearer <token>`). Tokens last 7 days. Logging out just forgets the token. Creating an account doesn't log you in: the page switches to the Log in tab with the email filled in. `auth.js` still has the old test mode that keeps accounts in localStorage (`USE_BACKEND: false`), but those accounts can't use the rest of the app, so leave it on `true`.

Tokens are signed with `AUTH_SECRET`. If that isn't set in `server/.env`, the server makes a random one the first time and saves it in `server/auth-secret.txt` (gitignored), so restarting doesn't log anyone out. Don't use a fixed, well-known secret: anyone who knows it can make a token for any account.

Passwords are hashed with scrypt and a random salt.

The page uses the same colors and system fonts as the rest of the app (Tailwind's grays and greens), so it doesn't load anything from the internet.

## Dark mode

The app and the login page follow the computer's light/dark setting. For the React pages this is done in `src/index.css`: Tailwind's colors are CSS variables, so in dark mode it flips the gray scale and darkens the pale green and blue backgrounds. The login page has its own dark colors in `public/login/style.css`. If you add a new color, check it in dark mode too (in Chrome DevTools: Rendering → Emulate CSS prefers-color-scheme: dark).

## Database

Same tables as the SRS (section 6) and the ER diagram, all in `server/db.js`:

| Table | Holds |
|---|---|
| `user` | email (unique, lowercase), password hash, display name |
| `food_item` | name, calories per serving, serving unit. `external_id` is the USDA id for USDA foods, `created_by` is the owner of a custom food |
| `entry` | one meal or snack: meal type, date, time, mood, location, activity |
| `entry_item` | each food in an entry, with its portion and the calories at the time it was logged |
| `goal` | daily calorie goal and reminder time |
| `water_log`, `weight_log`, `diary_note` | one row per user per day |

Tables are STRICT, foreign keys are on, and CHECK constraints repeat the main input rules, so bad data can't be saved even if a check in the code is missed. Daily totals are worked out from `entry_item`, not stored. A new database gets 33 starter foods.

The database version is kept in `PRAGMA user_version` (`SCHEMA_VERSION` in `db.js`). Whoever changes a table should bump it and add an upgrade step.

**Upgrading from the first backend:** a `data.db` made by the first version of the server (tables `users`, `foods`, `meal_entries`, `water_logs`, `weight_logs`, `diary_entries`) is upgraded automatically the first time the new server starts. Accounts (and their passwords), custom foods, meals, water, weight and diary notes are kept. Each old meal becomes an entry with one food at 12:00, and a calorie goal that was changed from the default 2000 is kept.

## Nutrition data (USDA FoodData Central)

Food search uses the local `food_item` table first. When it finds fewer than 5 matches, the search is at least 3 letters, and an API key is set, it also asks [FoodData Central](https://fdc.nal.usda.gov/api-guide): generic foods first, then branded products to fill the rest. Nothing is saved while searching. When the user picks a USDA food, the server saves just that one into `food_item` using its own copy of the search result, so the calories always come from USDA.

- Get a free key at https://fdc.nal.usda.gov/api-key-signup and put it in `FDC_API_KEY` in `server/.env`. Each teammate should use their own key, and never commit it (USDA deactivates keys found in public repos).
- With a real key the limit is 1,000 requests per hour. If USDA is down or slow (5-second limit), search quietly falls back to local foods.
- USDA search results give calories per 100 g, so USDA foods use a 100 g serving.
- The app footer credits USDA as the source of the data, as they ask.

## Browser tests

`e2e/uat.spec.mjs` has the browser tests, written with Playwright. They're labeled A through T and were done in addition to our Test Plan, so they don't follow its numbering, but they test the same features and more. Each test opens the app in Chromium and clicks through it like a user would. They run in order and build on each other (the account made in A is used for the rest), so if one fails, the ones after it don't run.

First time only, download the browser:

```bash
npx playwright install chromium
```

Then run `npm run test:e2e`. The tests start their own server on port 3456 with a fresh database in your temp folder, so your `server/data.db` is never touched and you don't need the app running.

- **USDA (E3, E4):** run only when `FDC_API_KEY` is set (in `server/.env` or the environment), otherwise they're skipped. If USDA doesn't answer after 3 tries they're skipped too.
- **Reminders (L2–L8):** use a fake clock, so they don't wait for real minutes (or a real day).
- **Login expiry (C5, C6):** C5 checks the token lasts 7 days, C6 swaps in an expired token instead of waiting a week.
- **Phone (S1, S2):** run at 390 px wide.
- **Dark mode and errors (T1, T2):** T1 opens every page in dark mode and checks the colors switch. T2 pretends the server is down and checks the login page says so.

## Running in GitHub Codespaces

Everything above works the same in a codespace. Four things to know:

1. **USDA key:** add a Codespaces secret instead of a `.env` file: github.com > Settings > Codespaces > New secret, name `FDC_API_KEY`, with access to the repo. The value is only the 40-character key. Restart the codespace after adding or changing it.
2. **Test browser:** the first-time install is `npx playwright install --with-deps chromium`.
3. **Two terminals:** open a second terminal with the **+** in the terminal panel, then run `npm run server` in one and `npm run dev` in the other.
4. **Opening the app:** open the forwarded port (5173, or 3001 after `npm run build` and `npm start`) from the Ports tab.

Stop the codespace when you're done (F1 > Codespaces: Stop Current Codespace) so it doesn't use up your free hours.

## Project layout

```
server/
  index.js        starts express, loads server/.env, serves dist after a build
  routes.js       sign up, log in, /me, and the other route groups
  auth.js         password hashing and login tokens
  db.js           tables, starter foods, upgrades from older databases
  validate.js     input rules for every request (zod)
  entries.js      meals: add, edit, delete, daily total, search, chart data
  foods.js        food search, custom foods, picking a usda food
  usda.js         talks to usda fooddata central
  tracking.js     goal and reminder, water, weight, diary
  test/           server tests (npm test)
public/login/     the login / create account page (plain html + js)
  index.html, style.css
  auth.js         talks to the server and keeps the login token (AUTH_CONFIG at the top)
  app.js          tabs, form checks, show/hide password
src/
  pages/          Home, Lookup, AddFood, Progress, History, Diary
  components/     Navbar, Reminder
  api.js          every call to the backend
  dates.js, meals.js, styles.js
e2e/              browser tests (npm run test:e2e)
```

## API

All routes are under `/api`. Everything except sign up and log in needs an `Authorization: Bearer <token>` header. Errors are `{ error, field }`, where `field` names the bad input when there is one.

| Method | Route | Body / Query |
| --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password }`, returns `{ token, user }` |
| POST | `/auth/login` | `{ email, password }`, returns `{ token, user }` |
| GET | `/me` | |
| GET | `/entries` | `?date=YYYY-MM-DD`, a day's entries plus the total |
| GET | `/entries/:id` | |
| POST | `/entries` | `{ date, time, mealType, mood?, location?, activity?, items: [{ foodId, portion }] }` |
| PUT | `/entries/:id` | same as POST |
| DELETE | `/entries/:id` | |
| GET | `/entries/search` | `?startDate=&endDate=&food=&mood=&location=&activity=` (all optional, newest 100) |
| GET | `/entries/trend` | `?endDate=YYYY-MM-DD&period=7`, daily totals for the chart |
| GET | `/foods` | `?q=search` |
| POST | `/foods` | `{ name, caloriesPerServing, servingUnit? }`, a custom food |
| POST | `/foods/external` | `{ externalId }`, saves the USDA food the user picked |
| GET | `/goal` | `?date=YYYY-MM-DD`, the goal plus that day's total (null if no goal) |
| PUT | `/goal/target` | `{ targetCalories }` (500 to 10,000) |
| PUT | `/goal/reminder` | `{ reminderTime }` (`HH:MM`, or null to turn it off) |
| GET / PUT | `/water` | `?date=` / `{ date, ounces }` |
| GET / PUT | `/weight` | all weigh-ins / `{ date, pounds }` (one per day) |
| DELETE | `/weight/:date` | |
| GET | `/diary` | dates with notes, newest first, with a short preview |
| GET / PUT | `/diary/:date` | `{ note }` (an empty note deletes it) |
