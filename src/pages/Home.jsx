//users homescreen
//able to see total calories and amount left
//able to add water intake by 8 ounces
//able to see all meals and snacks that have been added
//add food to all sections

import { useNavigate } from "react-router-dom";
import { Plus, Flame, Minus, Droplets } from "lucide-react";

export default function Home({
  userName,
  meals,
  totalCalories,
  dailyCalorieGoal,
  waterOz,
  setWaterOz,
  dailyWaterGoal,
}) {
  const navigate = useNavigate();

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
            <p className="text-green-100 mb-4">of {dailyCalorieGoal} cal goal</p>
            <div className="w-full bg-green-400/40 rounded-full h-3 mb-4">
              <div
                className="bg-white h-3 rounded-full transition-all duration-500"
                style={{ width: `${caloriePercent}%` }}
              />
            </div>
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
                      {items.map((item, index) => (
                        <div
                          key={index}
                          className="flex justify-between text-sm text-slate-700"
                        >
                          <span>{item.name}</span>
                          <span className="text-slate-500">
                            {item.calories} cal
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