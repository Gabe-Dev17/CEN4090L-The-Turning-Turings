import express from "express";
import routes from "./routes.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use("/api", routes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => console.log(`api running on http://localhost:${PORT}`));
