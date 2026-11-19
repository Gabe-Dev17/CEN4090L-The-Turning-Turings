//users addfoodscreen
//users ability to add a custom food that isn't in the lookup
//the food name, calories per serving, serving size, and what meal they ate it at
//the food is saved to their account so it shows up in lookup next time

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { api } from "../api";
import { today, nowTime } from "../dates";
import { MEALS, mealForTime } from "../meals";
import { card, input, label, greenButton, errorText } from "../styles";

export default function AddFood() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [servingUnit, setServingUnit] = useState("");
  const [portion, setPortion] = useState("1");
  const [meal, setMeal] = useState(() => mealForTime(nowTime()));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleDone(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Enter a food name.");
    if (calories === "" || Number(calories) < 0) return setError("Enter the calories per serving (0 or more).");
    if (!(Number(portion) > 0)) return setError("Servings eaten has to be more than 0.");

    setBusy(true);
    try {
      //save the food, then log it to the meal
      const food = await api.addCustomFood({ name, caloriesPerServing: Number(calories), servingUnit });
      await api.addEntry({
        date: today(),
        time: nowTime(),
        mealType: meal,
        items: [{ foodId: food.foodId, portion: Number(portion) }],
      });
      navigate("/");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Add Custom Food</h1>
      <p className="text-gray-500 mb-6">Can't find it in Lookup? Add it here and it'll be saved for next time.</p>
      {/*noValidate so the app's own messages show instead of the browser's popup*/}
      <form onSubmit={handleDone} noValidate className={`${card} p-6 space-y-5`}>
        <label className="block">
          <span className={label}>Food Name</span>
          <input name="foodName" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Chicken" className={input} />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={label}>Calories per Serving</span>
            <input name="calories" type="number" min="0" max="5000" inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="250" className={input} />
          </label>
          <label className="block">
            <span className={label}>Serving Size</span>
            <input name="servingUnit" value={servingUnit} maxLength={30} onChange={(e) => setServingUnit(e.target.value)} placeholder="1 cup" className={input} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={label}>Meal</span>
            <select name="meal" value={meal} onChange={(e) => setMeal(e.target.value)} className={input}>
              {MEALS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Servings Eaten</span>
            <input name="servings" type="number" min="0.25" max="100" step="0.25" inputMode="decimal" value={portion} onChange={(e) => setPortion(e.target.value)} className={input} />
          </label>
        </div>

        {error && <p role="alert" className={errorText}>{error}</p>}
        <button disabled={busy} className={`w-full ${greenButton}`}>
          <Check size={18} /> {busy ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}
