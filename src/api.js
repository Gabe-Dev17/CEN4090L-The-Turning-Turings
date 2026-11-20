//talks to the express server, vite proxies /api to localhost:3001

//the login page is Savannah's plain html page in public/login (not part of react)
export const LOGIN_PAGE = "/login/index.html"; //full name, vite dev would send "/login/" to react

export const getToken = () => localStorage.getItem("token");
export const setToken = (t) => (t ? localStorage.setItem("token", t) : localStorage.removeItem("token"));

async function request(method, url, body) {
  const res = await fetch(`/api${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  //not logged in anymore (token expired, logged out in another tab, or the database was reset), send back to login
  if (res.status === 401 && !url.startsWith("/auth")) {
    setToken(null);
    window.location.replace(LOGIN_PAGE);
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong. Try again.");
    err.status = res.status;
    err.field = data.field;
    throw err;
  }
  return data;
}

export const api = {
  //sign up and log in are on the login page (public/login/auth.js)
  me: () => request("GET", "/me"),

  //meals
  getDay: (date) => request("GET", `/entries?date=${date}`),
  getEntry: (id) => request("GET", `/entries/${id}`),
  addEntry: (entry) => request("POST", "/entries", entry),
  updateEntry: (id, entry) => request("PUT", `/entries/${id}`, entry),
  deleteEntry: (id) => request("DELETE", `/entries/${id}`),
  searchEntries: (filter) => request("GET", `/entries/search?${new URLSearchParams(filter)}`),
  getTrend: (endDate, period) => request("GET", `/entries/trend?endDate=${endDate}&period=${period}`),

  //foods
  searchFoods: (q) => request("GET", `/foods?q=${encodeURIComponent(q)}`),
  pickFood: (externalId) => request("POST", "/foods/external", { externalId }),
  addCustomFood: (food) => request("POST", "/foods", food),

  //goal and reminder
  getGoal: (date) => request("GET", `/goal?date=${date}`),
  setTarget: (targetCalories) => request("PUT", "/goal/target", { targetCalories }),
  setReminder: (reminderTime) => request("PUT", "/goal/reminder", { reminderTime }),

  //water, weight, diary
  getWater: (date) => request("GET", `/water?date=${date}`),
  setWater: (date, ounces) => request("PUT", "/water", { date, ounces }),
  getWeights: () => request("GET", "/weight"),
  setWeight: (date, pounds) => request("PUT", "/weight", { date, pounds }),
  deleteWeight: (date) => request("DELETE", `/weight/${date}`),
  getNotes: () => request("GET", "/diary"),
  getNote: (date) => request("GET", `/diary/${date}`),
  saveNote: (date, note) => request("PUT", `/diary/${date}`, { note }),
};
