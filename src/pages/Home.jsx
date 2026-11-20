//users homescreen
//able to see total calories and amount left for any day
//able to add water intake by 8 ounces
//able to see, edit, and delete all meals and snacks that have been added
//add food to all sections

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Minus, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { api } from "../api";
import { today, addDays, niceDate, niceTime } from "../dates";
import { MEALS, cal, WATER_GOAL } from "../meals";
import { card, errorText } from "../styles";

export default function Home({ user }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = params.get("date") || today();

  const [day, setDay] = useState(null);
  const [goal, setGoal] = useState(null);
  const [waterOz, setWaterOz] = useState(0);
  const [error, setError] = useState("");

  //View Daily Calorie Total: the day's entries, total, goal, and water
  const load = useCallback(() => {
    Promise.all([api.getDay(date), api.getGoal(date), api.getWater(date)])
      .then(([d, g, w]) => {
        setDay(d);
        setGoal(g);
        setWaterOz(w.ounces);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [date]);

  useEffect(load, [load]);

  const goTo = (d) => setParams(d === today() ? {} : { date: d });

  //water is saved right away. if saving fails, put the old number back
  async function changeWater(amount) {
    const old = waterOz;
    const next = Math.min(Math.max(0, old + amount), 400);
    setWaterOz(next);
    try {
      await api.setWater(date, next);
    } catch (err) {
      setWaterOz(old);
      setError(err.message);
    }
  }

  //User.deleteEntry
  async function remove(entry) {
    const what = entry.items.map((i) => i.name).join(", ");
    if (!window.confirm(`Delete this entry (${what})? This can't be undone.`)) return;
    try {
      await api.deleteEntry(entry.entryId);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const total = day?.total ?? 0;
  const target = goal?.targetCalories;
  //Goal.checkProgress: how much of the goal is eaten and how much is left
  const caloriePercent = target ? Math.min((total / target) * 100, 100) : 0;
  const caloriesLeft = target ? target - total : 0;
  const waterPercent = Math.min((waterOz / WATER_GOAL) * 100, 100);

  return (
    <div className="space-y-8">
      {/*page heading with day picker*/}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Welcome, {user.displayName}</h1>
          <p className="text-gray-500 mt-1">Daily calorie summary</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => goTo(addDays(date, -1))} aria-label="Previous day" className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50">
            <ChevronLeft size={18} />
          </button>
          <span className="font-semibold text-gray-700 min-w-[9.5rem] text-center">{niceDate(date)}</span>
          <button onClick={() => goTo(addDays(date, 1))} aria-label="Next day" className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50">
            <ChevronRight size={18} />
          </button>
          {date !== today() && (
            <button onClick={() => goTo(today())} className="text-sm text-green-600 font-medium hover:underline ml-1">Today</button>
          )}
        </div>
      </header>

      {error && <p role="alert" className={errorText}>{error}</p>}

      <div className="grid md:grid-cols-3 gap-6">
        {/*summary section*/}
        <div className="md:col-span-1 space-y-6">
          {/*calorie section*/}
          <section className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl p-6 shadow-lg">
            <h2 className="font-bold mb-4">{date === today() ? "Today's Calories" : "Calories"}</h2>
            <p className="text-4xl font-bold">{Math.round(total).toLocaleString()}</p>
            {target ? (
              <>
                <p className="text-green-100 mb-4">of {target.toLocaleString()} cal goal</p>
                <div
                  className="w-full bg-green-400/40 rounded-full h-3 mb-3"
                  role="progressbar"
                  aria-label="Calories eaten compared to the daily goal"
                  aria-valuemin={0}
                  aria-valuemax={target}
                  aria-valuenow={Math.round(total)}
                >
                  <div className="bg-white h-3 rounded-full transition-all duration-500" style={{ width: `${caloriePercent}%` }} />
                </div>
                <p className="text-sm text-green-100">
                  {caloriesLeft >= 0 ? `${cal(caloriesLeft)} left` : `${cal(-caloriesLeft)} over the goal`}
                </p>
              </>
            ) : (
              <p className="text-green-100">
                cal eaten. <Link to="/progress" className="underline text-white">Set a daily goal</Link>
              </p>
            )}
          </section>

          {/*water section*/}
          <section className={`${card} border-blue-100 p-6`}>
            <h2 className="font-bold text-gray-800 mb-4">Water</h2>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => changeWater(-8)}
                  disabled={waterOz === 0}
                  aria-label="Remove 8 oz"
                  className="bg-white text-blue-500 p-2 rounded-full shadow hover:bg-blue-100 transition disabled:opacity-60"
                >
                  <Minus size={20} />
                </button>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">{waterOz}</p>
                  <p className="text-sm text-blue-400 font-medium">of {WATER_GOAL} oz</p>
                </div>
                <button
                  onClick={() => changeWater(8)}
                  aria-label="Add 8 oz"
                  className="bg-blue-500 text-white p-2 rounded-full shadow hover:bg-blue-600 transition"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 mt-4">
                <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${waterPercent}%` }} />
              </div>
            </div>
          </section>
        </div>

        {/*meal section*/}
        <div className="md:col-span-2 grid sm:grid-cols-2 gap-4 content-start">
          {MEALS.map((meal) => {
            const entries = day ? day.entries.filter((e) => e.mealType === meal.value) : [];
            const mealTotal = entries.reduce((sum, e) => sum + e.totalCalories, 0);
            return (
              <section key={meal.value} className={`${card} overflow-hidden hover:shadow-md transition`}>
                <header className="px-5 py-3 bg-green-50 flex justify-between items-center border-b border-green-100">
                  <span className="font-semibold text-gray-800">{meal.label}</span>
                  <button
                    onClick={() => navigate(`/lookup?meal=${meal.value}&date=${date}`)}
                    aria-label={`Add food to ${meal.label}`}
                    className="bg-green-500 text-white rounded-full p-2 hover:bg-green-600 transition"
                  >
                    <Plus size={18} />
                  </button>
                </header>

                <div className="p-4 min-h-[100px]">
                  {entries.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">Nothing added</p>
                  ) : (
                    <div className="space-y-3">
                      {entries.map((entry) => (
                        <article key={entry.entryId} className="text-sm">
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-xs text-gray-400">{niceTime(entry.time)}</span>
                            <div className="flex gap-1">
                              <Link to={`/entries/${entry.entryId}/edit`} aria-label="Edit entry" className="p-1 text-gray-400 hover:text-green-600">
                                <Pencil size={14} />
                              </Link>
                              <button onClick={() => remove(entry)} aria-label="Delete entry" className="p-1 text-gray-400 hover:text-red-600">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          {entry.items.map((item) => (
                            <div key={item.foodId} className="flex justify-between gap-2 text-gray-700">
                              <span>
                                {item.name}
                                {item.portion !== 1 && <span className="text-gray-400"> x{item.portion}</span>}
                              </span>
                              <span className="text-gray-500 whitespace-nowrap">{cal(item.calories)}</span>
                            </div>
                          ))}
                          {(entry.mood || entry.location || entry.activity) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {[["Mood", entry.mood], ["At", entry.location], ["Doing", entry.activity]]
                                .filter(([, v]) => v)
                                .map(([what, v]) => (
                                  <span key={what} className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{what}: {v}</span>
                                ))}
                            </div>
                          )}
                        </article>
                      ))}
                      <div className="border-t pt-2 text-right text-xs font-bold text-green-600">Total: {cal(mealTotal)}</div>
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
