import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

//loads server/.env if there is one (AUTH_SECRET, FDC_API_KEY, PORT). has to happen
//before the other files load, since they read these when they start
try {
  process.loadEnvFile(path.join(dir, ".env"));
} catch {
  //no .env, that's fine for local testing
}
const { default: routes } = await import("./routes.js");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: "100kb" }));
app.use("/api", routes);
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

//after `npm run build`, express also serves the react app, so it's one server
const dist = path.join(dir, "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.use((req, res) => res.status(404).json({ error: "Not found" }));

//bad input from validate.js comes here as a 400 with the field it's about.
//express needs all four parameters to treat this as the error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "That request was not valid JSON." });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message, field: err.field });
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

export default app;

//only listen when run with `node index.js`, not when a test imports it
if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`api running on http://localhost:${PORT}`));
}
