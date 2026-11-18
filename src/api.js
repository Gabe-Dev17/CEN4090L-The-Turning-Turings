//talks to the express server, vite proxies /api to localhost:3001

export const getToken = () => localStorage.getItem("token");
export const setToken = (t) =>
  t ? localStorage.setItem("token", t) : localStorage.removeItem("token");

//local date as yyyy-mm-dd
export const todayStr = () => new Date().toLocaleDateString("en-CA");

async function request(method, url, body) {
  const res = await fetch(`/api${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  //token expired, send back to login
  if (res.status === 401 && getToken() && !url.startsWith("/auth")) {
    setToken(null);
    window.location.href = "/login";
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  register: (name, email, password) => request("POST", "/auth/register", { name, email, password }),
  login: (email, password) => request("POST", "/auth/login", { email, password }),
  me: () => request("GET", "/me"),
  setCalorieGoal: (calorieGoal) => request("PUT", "/me/calorie-goal", { calorieGoal }),

  searchFoods: (q = "") => request("GET", `/foods?q=${encodeURIComponent(q)}`),
  createFood: (name, calories) => request("POST", "/foods", { name, calories }),

  getMeals: (date = todayStr()) => request("GET", `/meals?date=${date}`),
  addMeal: (entry) => request("POST", "/meals", { date: todayStr(), ...entry }),
  deleteMeal: (id) => request("DELETE", `/meals/${id}`),

  getWater: (date = todayStr()) => request("GET", `/water?date=${date}`),
  setWater: (oz, date = todayStr()) => request("PUT", "/water", { oz, date }),

  getWeights: () => request("GET", "/weight"),
  addWeight: (date, weight) => request("POST", "/weight", { date, weight }),

  getDiary: () => request("GET", "/diary"),
  saveDiary: (date, note) => request("PUT", `/diary/${date}`, { note }),
};
