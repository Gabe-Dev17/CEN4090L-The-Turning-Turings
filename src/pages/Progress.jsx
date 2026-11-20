//users progressscreen
//calories over the last 7 or 30 days, with the daily goal as a dashed line
//set the daily calorie goal and a meal reminder
//track and log weight (lbs) by date, shown on a chart

import { useCallback, useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Trash2 } from "lucide-react";
import { api } from "../api";
import { today, shortDate, niceDate, niceTime } from "../dates";
import { cal } from "../meals";
import { card, input, label, greenButton, plainButton, errorText } from "../styles";

//lets the reminder banner know to reload the reminder time
const goalChanged = () => window.dispatchEvent(new Event("goal-changed"));
const canNotify = typeof Notification !== "undefined";

export default function Progress() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Your Progress</h1>
      <CalorieSection />
      <WeightSection />
    </div>
  );
}

//Track Nutrition Over Time + Set Goals and Reminders
function CalorieSection() {
  const [period, setPeriod] = useState(7);
  const [trend, setTrend] = useState(null);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [goal, setGoal] = useState(undefined); //undefined = loading, null = no goal yet
  const [target, setTarget] = useState("");
  const [time, setTime] = useState("");
  const [msg, setMsg] = useState({ target: "", reminder: "" });
  const [err, setErr] = useState({ load: "", target: "", reminder: "" });
  const [permission, setPermission] = useState(canNotify ? Notification.permission : "unsupported");

  useEffect(() => {
    api
      .getTrend(today(), period)
      .then((t) => setTrend(t.days.map((day, i) => ({ day: shortDate(day), date: day, calories: t.totals[i] }))))
      .catch((e) => setErr((old) => ({ ...old, load: e.message })));
  }, [period]);

  const loadGoal = useCallback(() => {
    api
      .getGoal(today())
      .then((g) => {
        setGoal(g);
        setTarget(g ? String(g.targetCalories) : "");
        setTime(g?.reminderTime ?? "");
      })
      .catch((e) => setErr((old) => ({ ...old, load: e.message })));
  }, []);

  useEffect(loadGoal, [loadGoal]);

  //Goal.setTarget
  async function saveTarget(e) {
    e.preventDefault();
    setMsg({ ...msg, target: "" });
    setErr({ ...err, target: "" });
    try {
      await api.setTarget(Number(target));
      setMsg({ ...msg, target: "Goal saved." });
      loadGoal();
      goalChanged();
    } catch (e2) {
      setErr({ ...err, target: e2.message });
    }
  }

  //Goal.setReminder. blank turns it off
  async function saveReminder(value) {
    setMsg({ ...msg, reminder: "" });
    setErr({ ...err, reminder: "" });
    try {
      const g = await api.setReminder(value || null);
      setTime(g.reminderTime ?? "");
      setGoal((old) => ({ ...old, reminderTime: g.reminderTime }));
      setMsg({ ...msg, reminder: g.reminderTime ? `Reminder set for ${niceTime(g.reminderTime)}.` : "Reminder turned off." });
      goalChanged();
    } catch (e2) {
      setErr({ ...err, reminder: e2.message });
    }
  }

  async function allowNotifications() {
    setPermission(await Notification.requestPermission());
  }

  const logged = trend ? trend.filter((d) => d.calories > 0) : [];
  const avg = logged.length ? logged.reduce((s, d) => s + d.calories, 0) / logged.length : 0;
  const goalLine = goal?.targetCalories;

  //evenly spaced date labels that always include today: every day for 7 days,
  //and for 30 days every 3rd day counting back from today (every 6th on a phone, so they don't overlap)
  const days = trend ?? [];
  const step = days.length > 7 ? (narrow ? 6 : 3) : 1;
  const dayTicks = days.filter((_, i) => (days.length - 1 - i) % step === 0).map((d) => d.day);
  //y-axis from 0 to a round number at or above the highest day and the goal,
  //with up to 7 evenly spaced labels (so the top label never crowds the one below it)
  const calTop = Math.max(Math.max(0, ...days.map((d) => d.calories)) * 1.05, goal?.targetCalories ?? 0, 100); //5% headroom so the top dot isn't cut off
  const calStep = [25, 50, 100, 250, 500, 1000].find((n) => calTop / n <= 6) ?? 2000;
  const calHi = Math.ceil(calTop / calStep) * calStep;
  const calTicks = [];
  for (let t = 0; t <= calHi; t += calStep) calTicks.push(t);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/*calorie chart section*/}
      <section className={`lg:col-span-2 ${card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800">Calories</h2>
          <select name="period"
            aria-label="Period"
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
        {err.load && <p role="alert" className={errorText}>{err.load}</p>}
        <div className="h-72">
          {trend && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#6a7282" fontSize={12} ticks={dayTicks} interval={0} />
                <YAxis stroke="#6a7282" fontSize={12} width={48} domain={[0, calHi]} ticks={calTicks} interval={0} allowDecimals={false} />
                <Tooltip formatter={(v) => [cal(v), "Calories"]} labelFormatter={(_, p) => (p[0] ? niceDate(p[0].payload.date) : "")} />
                {goalLine && <ReferenceLine y={goalLine} stroke="#fe9a00" strokeDasharray="6 4" label={{ value: "Goal", position: "insideTopRight", fill: "#bb4d00", fontSize: 12 }} />}
                <Line type="monotone" dataKey="calories" stroke="#00c950" strokeWidth={3} dot={{ r: period > 7 ? 2 : 4, fill: "#00c950" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {logged.length ? `Average on logged days: ${cal(avg)} (${logged.length} of ${period} days logged)` : "Nothing logged in this period yet."}
        </p>
      </section>

      {/*goal + reminder section*/}
      <section className={`${card} p-6 space-y-5`}>
        {/*noValidate so the app's own messages show instead of the browser's popup*/}
        <form onSubmit={saveTarget} noValidate className="space-y-3">
          <h2 className="font-bold text-gray-800">Daily Calorie Goal</h2>
          <label className="block">
            <span className={label}>Calories per day</span>
            {/*disabled until the saved goal loads, so loading it can't wipe what someone typed*/}
            <input name="calorieGoal"
              type="number"
              inputMode="numeric"
              min={500}
              max={10000}
              step={1}
              placeholder="2000"
              disabled={goal === undefined}
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setMsg((old) => ({ ...old, target: "" }));
                setErr((old) => ({ ...old, target: "" }));
              }}
              className={`${input} disabled:bg-gray-50`}
            />
          </label>
          {err.target && <p role="alert" className={errorText}>{err.target}</p>}
          {msg.target && <p role="status" className="text-sm text-green-600">{msg.target}</p>}
          <button className={`w-full ${greenButton}`}>Save goal</button>
        </form>

        <hr className="border-gray-100" />

        <form onSubmit={(e) => { e.preventDefault(); saveReminder(time); }} className="space-y-3">
          <h2 className="font-bold text-gray-800">
            Meal Reminder <span className="font-normal text-sm text-gray-400">(optional)</span>
          </h2>
          {goal === null && <p className="text-sm text-gray-500">Set a daily goal first, then you can add a reminder.</p>}
          <label className="block">
            <span className={label}>Remind me at</span>
            <input name="reminderTime"
              type="time"
              disabled={!goal}
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setMsg((old) => ({ ...old, reminder: "" }));
              }}
              className={`${input} disabled:bg-gray-50`}
            />
          </label>
          <p className="text-xs text-gray-400">Reminders show while the app is open in a browser tab. Leave it blank to turn them off.</p>
          {err.reminder && <p role="alert" className={errorText}>{err.reminder}</p>}
          {msg.reminder && <p role="status" className="text-sm text-green-600">{msg.reminder}</p>}
          <div className="flex gap-2">
            <button disabled={!goal} className={`flex-1 ${plainButton}`}>Save reminder</button>
            {goal?.reminderTime && (
              <button type="button" onClick={() => saveReminder(null)} className={plainButton}>Turn off</button>
            )}
          </div>
          {goal?.reminderTime && permission === "default" && (
            <button type="button" onClick={allowNotifications} className="text-sm text-green-600 hover:underline">
              Also show reminders as browser notifications
            </button>
          )}
        </form>
      </section>
    </div>
  );
}

//weight log, one weigh-in per day
function WeightSection() {
  const [data, setData] = useState([]);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getWeights().then(setData).catch((e) => setError(e.message));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    if (!(Number(weight) > 0)) return setError("Enter your weight in pounds.");
    if (!date) return setError("Pick a date.");
    if (date > today()) return setError("You can't log a weight for a future date.");
    try {
      setData(await api.setWeight(date, Number(weight)));
      setWeight("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(d) {
    try {
      setData(await api.deleteWeight(d));
    } catch (err) {
      setError(err.message);
    }
  }

  const chartData = data.map((w) => ({ ...w, day: shortDate(w.date) }));
  //y-axis from a round number below the lightest weigh-in to one above the heaviest,
  //with evenly spaced labels (every 5 lbs, or 10/20/50 when the range is wide)
  const pounds = data.map((w) => w.pounds);
  const lo = Math.floor((Math.min(...pounds) - 2) / 5) * 5;
  const hi = Math.ceil((Math.max(...pounds) + 2) / 5) * 5;
  const yStep = [5, 10, 20, 50, 100].find((n) => (hi - lo) / n <= 6) ?? 200;
  const yLo = Math.floor(lo / yStep) * yStep;
  const yHi = Math.ceil(hi / yStep) * yStep;
  const yTicks = [];
  for (let t = yLo; t <= yHi; t += yStep) yTicks.push(t);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/*weight section*/}
      <section className={`lg:col-span-1 ${card} p-6`}>
        <form onSubmit={handleAdd} noValidate className="space-y-3">
          <h2 className="font-bold text-gray-800">Log Weight</h2>
          <label className="block">
            <span className={label}>Weight (lbs)</span>
            <input name="weight" type="number" inputMode="decimal" min="1" max="1000" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>Date</span>
            <input name="weightDate" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>
          {error && <p role="alert" className={errorText}>{error}</p>}
          <button className={`w-full ${greenButton}`}>Add</button>
        </form>

        {data.length > 0 && (
          <ul className="mt-5 divide-y divide-gray-100 max-h-48 overflow-y-auto text-sm">
            {[...data].reverse().map((w) => (
              <li key={w.date} className="py-2 flex items-center justify-between">
                <span className="text-gray-600">{niceDate(w.date)}</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{w.pounds} lbs</span>
                  <button onClick={() => handleDelete(w.date)} aria-label={`Delete weight for ${w.date}`} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*weight chart section*/}
      <section className={`lg:col-span-2 ${card} p-6 h-96`}>
        {data.length === 0 ? (
          <p className="text-gray-400 italic h-full flex items-center justify-center">Log a weight to start your chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" stroke="#6a7282" fontSize={12} />
              <YAxis stroke="#6a7282" fontSize={12} width={48} domain={[yLo, yHi]} ticks={yTicks} interval={0} />
              <Tooltip formatter={(v) => [`${v} lbs`, "Weight"]} labelFormatter={(_, p) => (p[0] ? niceDate(p[0].payload.date) : "")} />
              <Line type="monotone" dataKey="pounds" stroke="#00c950" strokeWidth={3} dot={{ r: 5, fill: "#00c950" }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
