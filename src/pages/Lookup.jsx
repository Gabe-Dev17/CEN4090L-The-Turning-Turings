//users lookupscreen
//able to look up foods (our list + usda) and add them to any meal or snack
//portions, time, and how they felt / where they were / what they were doing
//the same page edits an entry that was already saved

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Search, X, Check, Trash2 } from "lucide-react";
import { api } from "../api";
import { today, nowTime } from "../dates";
import { MEALS, cal, mealForTime } from "../meals";
import { card, input, smallInput, label, greenButton, plainButton, errorText } from "../styles";

//FoodItem.getCalories, same rounding as the server
const itemCalories = (item) => Math.round(item.caloriesPerServing * (Number(item.portion) || 0) * 10) / 10;

//new key on every visit, so going from "edit" to a new lookup starts with an empty form
export default function Lookup() {
  const location = useLocation();
  return <EntryForm key={location.key} />;
}

function EntryForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(() => {
    const time = nowTime();
    return {
      date: params.get("date") || today(),
      time,
      mealType: params.get("meal") || mealForTime(time),
      mood: "",
      location: "",
      activity: "",
    };
  });
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ q: "", foods: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!editing);

  //editing: fill the form with the saved entry
  useEffect(() => {
    if (!editing) return;
    api
      .getEntry(id)
      .then((e) => {
        setForm({ date: e.date, time: e.time, mealType: e.mealType, mood: e.mood ?? "", location: e.location ?? "", activity: e.activity ?? "" });
        setItems(e.items.map((i) => ({ ...i, portion: String(i.portion) })));
        setReady(true);
      })
      .catch((err) => setError(err.message));
  }, [id, editing]);

  //Look Up Calories: search a moment after the user stops typing.
  //results remember which text they were for, so a slow old search can't show up late
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let stale = false;
    const timer = setTimeout(() => {
      api
        .searchFoods(q)
        .then((foods) => !stale && setResults({ q, foods }))
        .catch(() => !stale && setResults({ q, foods: [] }));
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query]);

  const q = query.trim();
  const showResults = q.length >= 2 && results.q === q;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  //Entry.addItem. adding a food that's already on the plate bumps its portion.
  //usda foods aren't in our db until they're picked, so save that one first
  async function addItem(food) {
    if (!food.foodId) {
      try {
        food = await api.pickFood(food.externalId);
      } catch (err) {
        return setError(err.message);
      }
    }
    setError("");
    const found = items.find((i) => i.foodId === food.foodId);
    if (found) {
      setItems(items.map((i) => (i === found ? { ...i, portion: String(Number(i.portion || 0) + 1) } : i)));
    } else {
      setItems([...items, { ...food, portion: "1" }]);
    }
    setQuery("");
  }

  //Entry.removeItem
  const removeItem = (foodId) => setItems(items.filter((i) => i.foodId !== foodId));
  const setPortion = (foodId, portion) => setItems(items.map((i) => (i.foodId === foodId ? { ...i, portion } : i)));

  const total = items.reduce((sum, i) => sum + itemCalories(i), 0);
  const backTo = form.date === today() ? "/" : `/?date=${form.date}`;

  async function save() {
    setError("");
    if (items.length === 0) return setError("Add at least one food.");
    if (items.some((i) => !(Number(i.portion) > 0))) return setError("Every portion has to be more than 0.");

    const entry = { ...form, items: items.map((i) => ({ foodId: i.foodId, portion: Number(i.portion) })) };
    setBusy(true);
    try {
      if (editing) await api.updateEntry(id, entry);
      else await api.addEntry(entry);
      navigate(backTo);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    try {
      await api.deleteEntry(id);
      navigate(backTo);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!ready) {
    return error ? <p role="alert" className={errorText}>{error}</p> : <p className="text-gray-400 text-center py-16">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">{editing ? "Edit Entry" : "Food Lookup"}</h1>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {/*searchBar*/}
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input name="foodSearch"
              type="search"
              placeholder="search for a food"
              aria-label="Search for a food"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/*results*/}
          {showResults && (
            <div className="grid sm:grid-cols-2 gap-3" aria-label="Search results">
              {results.foods.length === 0 ? (
                <p className="text-gray-400 sm:col-span-2 text-center py-6">
                  No foods found. <Link to="/add" className="text-green-600 hover:underline">Add your own</Link>
                </p>
              ) : (
                results.foods.map((food) => (
                  <div key={food.foodId ?? food.externalId} className={`${card} rounded-xl p-4 flex justify-between items-center gap-3 hover:shadow-md transition`}>
                    <div>
                      <p className="font-semibold text-gray-800">{food.name}</p>
                      <p className="text-sm text-gray-500">
                        {cal(food.caloriesPerServing)} per {food.servingUnit}
                        {food.custom && <span className="ml-2 text-xs text-green-600">your food</span>}
                      </p>
                    </div>
                    <button onClick={() => addItem(food)} aria-label={`Add ${food.name}`} className="bg-green-500 text-white rounded-full p-2 hover:bg-green-600 transition shrink-0">
                      <Plus size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/*the foods in this entry*/}
          <section className={`${card} p-6`}>
            <h2 className="font-bold text-gray-800 mb-3">Foods in this entry</h2>
            {items.length === 0 ? (
              <p className="text-gray-400 text-sm italic">Search for a food above and press + to add it.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((item) => (
                  <li key={item.foodId} className="py-3 flex flex-wrap items-center gap-3">
                    <span className="flex-1 min-w-[8rem] font-medium text-gray-700">{item.name}</span>
                    <label className="flex items-center gap-2 text-sm text-gray-500">
                      <input name={`portion-${item.foodId}`}
                        type="number"
                        inputMode="decimal"
                        min="0.25"
                        max="100"
                        step="0.25"
                        aria-label={`Portion of ${item.name}`}
                        value={item.portion}
                        onChange={(e) => setPortion(item.foodId, e.target.value)}
                        className={`${smallInput} w-20`}
                      />
                      x {item.servingUnit}
                    </label>
                    <span className="w-20 text-right text-gray-700">{cal(itemCalories(item))}</span>
                    <button onClick={() => removeItem(item.foodId)} aria-label={`Remove ${item.name}`} className="p-1 text-gray-400 hover:text-red-600">
                      <X size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/*mealSelector + when*/}
          <section className={`${card} p-6 space-y-4`}>
            <div>
              <p className="text-sm text-gray-500 mb-2">Add to:</p>
              <div className="flex flex-wrap gap-2">
                {MEALS.map((meal) => (
                  <button
                    key={meal.value}
                    onClick={() => setForm({ ...form, mealType: meal.value })}
                    aria-pressed={form.mealType === meal.value}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      form.mealType === meal.value ? "bg-green-500 text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {meal.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={label}>Date</span>
                <input name="date" type="date" required value={form.date} onChange={set("date")} className={input} />
              </label>
              <label className="block">
                <span className={label}>Time</span>
                <input name="time" type="time" required value={form.time} onChange={set("time")} className={input} />
              </label>
            </div>
          </section>

          {/*context, all optional*/}
          <section className={`${card} p-6 space-y-3`}>
            <h2 className="font-bold text-gray-800">
              How it went <span className="font-normal text-sm text-gray-400">(optional)</span>
            </h2>
            <label className="block">
              <span className={label}>Mood</span>
              <input name="mood" maxLength={100} placeholder="happy, stressed, tired" value={form.mood} onChange={set("mood")} className={input} />
            </label>
            <label className="block">
              <span className={label}>Location</span>
              <input name="location" maxLength={100} placeholder="home, work, restaurant" value={form.location} onChange={set("location")} className={input} />
            </label>
            <label className="block">
              <span className={label}>Activity</span>
              <input name="activity" maxLength={100} placeholder="watching TV, studying" value={form.activity} onChange={set("activity")} className={input} />
            </label>
          </section>

          {/*total and save*/}
          <section className={`${card} p-6 space-y-3`}>
            <div className="flex justify-between items-baseline">
              <span className="text-gray-500">Entry total</span>
              <strong className="text-2xl text-gray-800">{cal(total)}</strong>
            </div>
            {error && <p role="alert" className={errorText}>{error}</p>}
            <button onClick={save} disabled={busy} className={`w-full ${greenButton}`}>
              <Check size={18} /> {busy ? "Saving..." : "Save"}
            </button>
            <Link to={backTo} className={`w-full ${plainButton}`}>Cancel</Link>
            {editing && (
              <button onClick={remove} className="w-full py-3 rounded-lg font-medium text-red-600 border border-red-200 hover:bg-red-50 transition flex items-center justify-center gap-2">
                <Trash2 size={18} /> Delete entry
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
