# Calorie Tracker

React + Vite frontend with an Express + SQLite backend.

## Requirements

- Node.js 22.5 or newer (`node -v` to check). The backend uses Node's built-in SQLite.

## Setup

From the project folder:

```bash
npm install
npm install --prefix server
```

## Running

Open two terminals in VS Code.

Terminal 1 (backend, http://localhost:3001):

```bash
npm run server
```

Terminal 2 (frontend, http://localhost:5173):

```bash
npm run dev
```

Go to http://localhost:5173. The frontend sends `/api` requests to the backend through the Vite proxy.

The database is created at `server/data.db` the first time the server starts. It's in `.gitignore`. Delete it to start fresh.

## API

All routes are under `/api`. Everything except register/login needs an `Authorization: Bearer <token>` header.

| Method | Route | Body / Query |
| --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password }` |
| POST | `/auth/login` | `{ email, password }` |
| GET | `/me` | |
| GET | `/foods` | `?q=search` |
| POST | `/foods` | `{ name, calories }` |
| GET | `/meals` | `?date=YYYY-MM-DD` (defaults to today) |
| POST | `/meals` | `{ meal, name, calories, foodId?, date? }` |
| DELETE | `/meals/:id` | |
| GET | `/water` | `?date=YYYY-MM-DD` |
| PUT | `/water` | `{ oz, date? }` |
| GET | `/weight` | |
| POST | `/weight` | `{ date, weight }` |
| DELETE | `/weight/:id` | |
| GET | `/diary` | |
| PUT | `/diary/:date` | `{ note }` (empty note deletes it) |
