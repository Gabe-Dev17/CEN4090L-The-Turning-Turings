//users homescreen
//able to see total calories and amount left
//able to add water intake by 8 ounces
//able to see all meals and snacks that have been added
//add food to all sections

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Minus, X, Pencil } from "lucide-react";

export default function Home({
  userName,
  meals,
  totalCalories,
  dailyCalorieGoal,
  setCalorieGoal,
  waterOz,
  setWaterOz,
  dailyWaterGoal,
  removeFood,
}) {
  const navigate = useNavigate();
  //goal editing
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalError, setGoalError] = useState("");

  const startEditGoal = () => {
    setGoalInput(String(dailyCalorieGoal));
    setGoalError("");
    setEditingGoal(true);
  };

  const saveGoal = async (e) => {
    e.preventDefault();
    try {
      await setCalorieGoal(Number(goalInput));
      setEditingGoal(false);
    } catch (err) {
      setGoalError(err.message);
    }
  };

  const caloriePercent = Math.min((totalCalories / dailyCalorieGoal) * 100, 100);
  const caloriesRemaining = dailyCalorieGoal - totalCalories;
  const waterPercent = Math.min((waterOz / dailyWaterGoal) * 100, 100);

  return (
    <div className="space-y-8">
      {/*page heading */}
      <header>
        <h1 className="text-3xl font-bold text-slate-800">
          Welcome, {userName}
        </h1>
        <p className="text-slate-500 mt-1">daily calorie summary</p>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        {/*summary section*/}
        <div className="md:col-span-1 space-y-6">
          {/*calorie section*/}
          <section className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold">Today's Calories</h2>
            </div>
            <p className="text-4xl font-bold">{totalCalories}</p>
            {editingGoal ? (
              <form onSubmit={saveGoal} className="mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    aria-label="Daily calorie goal"
                    autoFocus
                    className="w-24 rounded-lg px-2 py-1 text-slate-800"
                  />
                  <button type="submit" className="bg-white text-green-600 font-semibold text-sm px-3 py-1 rounded-lg hover:bg-green-50">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingGoal(false)} className="text-green-100 text-sm hover:text-white">
                    Cancel
                  </button>
                </div>
                {goalError && <p className="text-sm text-red-100 mt-1">{goalError}</p>}
              </form>
            ) : (
              <p className="text-green-100 mb-4 flex items-center gap-2">
                of {dailyCalorieGoal} cal goal
                <button onClick={startEditGoal} aria-label="Edit calorie goal" className="hover:text-white transition">
                  <Pencil size={14} />
                </button>
              </p>
            )}
            <div className="w-full bg-green-400/40 rounded-full h-3 mb-4">
              <div
                className="bg-white h-3 rounded-full transition-all duration-500"
                style={{ width: `${caloriePercent}%` }}
              />
            </div>
            <p className="text-sm text-green-100">
              {caloriesRemaining >= 0
                ? `${caloriesRemaining} cal remaining`
                : `${-caloriesRemaining} cal over goal`}
            </p>
          </section>

          {/*water section*/}
          {/*up b*/}
          <section className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Water</h2>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setWaterOz(Math.max(0, waterOz - 8))}
                  aria-label="Remove 8 oz"
                  className="bg-white text-blue-500 p-2 rounded-full shadow hover:bg-blue-100 transition"
                >
                  <Minus size={20} />
                </button>

                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">{waterOz}</p>
                  <p className="text-sm text-blue-400 font-medium">oz</p>
                </div>

                <button
                  onClick={() => setWaterOz(waterOz + 8)}
                  aria-label="Add 8 oz"
                  className="bg-blue-500 text-white p-2 rounded-full shadow hover:bg-blue-600 transition"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="w-full bg-blue-200 rounded-full h-2 mt-4">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${waterPercent}%` }}
                />
              </div>
            </div>
          </section>
        </div>

        {/*meal section*/}
        <div className="md:col-span-2 grid sm:grid-cols-2 gap-4">
          {Object.entries(meals).map(([mealName, items]) => {
            const mealTotal = items.reduce((sum, item) => sum + item.calories, 0);
            return (
              <section
                key={mealName}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition"
              >
                <header className="px-5 py-3 bg-green-50 flex justify-between items-center border-b border-green-100">
                  <span className="font-semibold text-slate-800">{mealName}</span>
                  <button
                    onClick={() => navigate("/lookup")}
                    aria-label={`Add food to ${mealName}`}
                    className="bg-green-500 text-white rounded-full p-1 hover:bg-green-600 transition"
                  >
                    <Plus size={16} />
                  </button>
                </header>

                <div className="p-4 min-h-[100px]">
                  {items.length === 0 ? (
                    <p className="text-slate-400 text-sm italic">
                      Nothing added
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center text-sm text-slate-700 group"
                        >
                          <span>{item.name}</span>
                          <span className="flex items-center gap-2 text-slate-500">
                            {item.calories} cal
                            <button
                              onClick={() => removeFood(mealName, item.id)}
                              aria-label={`Remove ${item.name}`}
                              className="text-slate-300 hover:text-red-500 transition"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        </div>
                      ))}
                      <div className="border-t mt-2 pt-2 text-right text-xs font-bold text-green-600">
                        Total: {mealTotal} cal
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}