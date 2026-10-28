import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Progress from "./pages/Progress";
import AddFood from "./pages/AddFood";
import Lookup from "./pages/Lookup";
import Diary from "./pages/Diary";
import Navbar from "./components/Navbar";

export default function App() {
  const [userName] = useState("Dunya");
  const [dailyCalorieGoal] = useState(2000);
  const [dailyWaterGoal] = useState(64);

  const [meals, setMeals] = useState({
    Breakfast: [],
    Lunch: [],
    Dinner: [],
    Snacks: [],
  });

  //water in oz
  const [waterOz, setWaterOz] = useState(0);

  const addFoodToMeal = (mealName, food) => {
    setMeals((prev) => ({
      ...prev,
      [mealName]: [...prev[mealName], food],
    }));
  };

  const totalCalories = Object.values(meals)
    .flat()
    .reduce((sum, item) => sum + item.calories, 0);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route
              path="/"
              element={
                <Home
                  userName={userName}
                  meals={meals}
                  totalCalories={totalCalories}
                  dailyCalorieGoal={dailyCalorieGoal}
                  waterOz={waterOz}
                  setWaterOz={setWaterOz}
                  dailyWaterGoal={dailyWaterGoal}
                />
              }
            />
            <Route path="/progress" element={<Progress />} />
            <Route path="/add" element={<AddFood addFoodToMeal={addFoodToMeal} />} />
            <Route path="/lookup" element={<Lookup addFoodToMeal={addFoodToMeal} />} />
            <Route path="/diary" element={<Diary />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}