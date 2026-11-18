import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Progress from "./pages/Progress";
import AddFood from "./pages/AddFood";
import Lookup from "./pages/Lookup";
import Diary from "./pages/Diary";
import Login from "./pages/Login";
import Navbar from "./components/Navbar";
import { api, getToken, setToken } from "./api";

const emptyMeals = { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] };

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const [meals, setMeals] = useState(emptyMeals);
  //water in oz
  const [waterOz, setWaterOz] = useState(0);

  //check saved token on load
  useEffect(() => {
    if (!getToken()) return;
    api.me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  //load todays meals and water once logged in
  useEffect(() => {
    if (!user) return;
    api.getMeals().then(setMeals);
    api.getWater().then((w) => setWaterOz(w.oz));
  }, [user?.id]);

  const addFoodToMeal = async (mealName, food) => {
    const entry = await api.addMeal({
      meal: mealName,
      name: food.name,
      calories: food.calories,
      foodId: food.id ?? null,
    });
    setMeals((prev) => ({ ...prev, [mealName]: [...prev[mealName], entry] }));
  };

  const removeFood = async (mealName, id) => {
    await api.deleteMeal(id);
    setMeals((prev) => ({ ...prev, [mealName]: prev[mealName].filter((f) => f.id !== id) }));
  };

  const updateWater = (oz) => {
    setWaterOz(oz);
    api.setWater(oz);
  };

  //throws so Home can show the error
  const updateCalorieGoal = async (goal) => {
    setUser(await api.setCalorieGoal(goal));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setMeals(emptyMeals);
    setWaterOz(0);
  };

  if (loading) return null;

  //not logged in, only login/signup work, everything else goes to /login
  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login key="login" mode="login" onLogin={setUser} />} />
          <Route path="/signup" element={<Login key="signup" mode="signup" onLogin={setUser} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const totalCalories = Object.values(meals)
    .flat()
    .reduce((sum, item) => sum + item.calories, 0);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Navbar onLogout={logout} />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  userName={user.name}
                  meals={meals}
                  totalCalories={totalCalories}
                  dailyCalorieGoal={user.calorieGoal}
                  setCalorieGoal={updateCalorieGoal}
                  waterOz={waterOz}
                  setWaterOz={updateWater}
                  dailyWaterGoal={user.waterGoal}
                  removeFood={removeFood}
                />
              }
            />
            <Route path="/progress" element={<Progress />} />
            <Route path="/add" element={<AddFood addFoodToMeal={addFoodToMeal} />} />
            <Route path="/lookup" element={<Lookup addFoodToMeal={addFoodToMeal} />} />
            <Route path="/diary" element={<Diary />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
