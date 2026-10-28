//users addfoodscreen
//users ability to add custom food
//the food name
//the calories per serving
//and what meal they ate it at

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

export default function AddFood({ addFoodToMeal }) {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [meal, setMeal] = useState("Breakfast");
  const navigate = useNavigate();

  const handleDone = () => {
    if (!name || !calories) return;
    addFoodToMeal(meal, { name, calories: Number(calories) });
    navigate("/");
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Add Custom Food</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">
            Food Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chicken"
            className="w-full border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">
            Calories per Serving
          </label>
          <input
            type="number"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="250"
            className="w-full border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-2">
            Meal
          </label>
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {["Breakfast", "Lunch", "Dinner", "Snacks"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleDone}
          className="w-full bg-green-500 text-white py-3 rounded-lg font-medium hover:bg-green-600 transition flex items-center justify-center gap-2"
        >
          <Check size={18} /> Save
        </button>
      </div>
    </div>
  );
}