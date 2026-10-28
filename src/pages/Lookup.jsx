//users lookupscreen
//able to look up foods and add food to any meals or snacks
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { mockFoods } from "../data/mockFoods";

export default function Lookup({ addFoodToMeal }) {
  const [query, setQuery] = useState("");
  const [selectedMeal, setSelectedMeal] = useState("Breakfast");
  const navigate = useNavigate();

  const mealOptions = ["Breakfast", "Lunch", "Dinner", "Snacks"];

  const results = mockFoods.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleAdd = (food) => {
    addFoodToMeal(selectedMeal, food);
    navigate("/");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Food Lookup</h1>
      {/*searchBar*/}
      <div className="relative mb-4">
        <Search
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="search for a food"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/*mealSelector*/}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-2">Add to:</p>
        <div className="flex flex-wrap gap-2">
          {mealOptions.map((meal) => (
            <button
              key={meal}
              onClick={() => setSelectedMeal(meal)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedMeal === meal
                  ? "bg-green-500 text-white shadow"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {meal}
            </button>
          ))}
        </div>
      </div>

      {/*results*/}
      <div className="grid sm:grid-cols-2 gap-3">
        {results.length === 0 ? (
          <p className="text-gray-400 col-span-2 text-center py-8">
            No foods found.
          </p>
        ) : (
          results.map((food) => (
            <div
              key={food.id}
              className="bg-white rounded-xl p-4 flex justify-between items-center shadow-sm border border-gray-100 hover:shadow-md transition"
            >
              <div>
                <p className="font-semibold text-gray-800">{food.name}</p>
                <p className="text-sm text-gray-500">{food.calories} cal</p>
              </div>
              <button
                onClick={() => handleAdd(food)}
                className="bg-green-500 text-white rounded-full p-2 hover:bg-green-600 transition"
              >
                <Plus size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}