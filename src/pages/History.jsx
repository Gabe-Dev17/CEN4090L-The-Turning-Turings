//users historyscreen
//search past entries by date range, food, mood, location, or activity
//any entry can be opened and edited from here

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { api } from "../api";
import { niceDate, niceTime } from "../dates";
import { mealLabel, cal } from "../meals";
import { card, smallInput, label, greenButton, plainButton, errorText } from "../styles";

//the EntryFilter from the class diagram, all blank to start
const EMPTY = { startDate: "", endDate: "", food: "", mood: "", location: "", activity: "" };

const fields = [
  ["startDate", "From", "date"],
  ["endDate", "To", "date"],
  ["food", "Food", "text"],
  ["mood", "Mood", "text"],
  ["location", "Location", "text"],
  ["activity", "Activity", "text"],
];

export default function History() {
  const [filter, setFilter] = useState(EMPTY);
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  //User.searchEntries
  function search(f) {
    api
      .searchEntries(f)
      .then((r) => {
        setResults(r);
        setError("");
      })
      .catch((err) => setError(err.message));
  }

  //start by showing the newest entries
  useEffect(() => search(EMPTY), []);

  function submit(e) {
    e.preventDefault();
    setSearched(Object.values(filter).some((v) => v.trim()));
    search(filter);
  }

  function clear() {
    setFilter(EMPTY);
    setSearched(false);
    search(EMPTY);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">History</h1>

      <form onSubmit={submit} aria-label="Search and filter entries" className={`${card} p-6`}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {fields.map(([key, text, type]) => (
            <label key={key} className="block">
              <span className={label}>{text}</span>
              <input name={key}
                type={type}
                maxLength={type === "text" ? 100 : undefined}
                placeholder={type === "text" ? "Any" : undefined}
                value={filter[key]}
                onChange={(e) => setFilter({ ...filter, [key]: e.target.value })}
                className={`${smallInput} w-full`}
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button className={greenButton}>Search</button>
          {searched && (
            <button type="button" onClick={clear} className={plainButton}>Clear</button>
          )}
        </div>
      </form>

      <section aria-live="polite" className={`${card} p-6`}>
        <h2 className="font-bold text-gray-800 mb-3">{searched ? "Matching entries" : "Recent entries"}</h2>
        {error && <p role="alert" className={errorText}>{error}</p>}
        {results && results.length === 0 && (
          <p className="text-gray-400 text-sm italic">{searched ? "No entries match" : "No entries yet"}</p>
        )}
        <ul className="divide-y divide-gray-100">
          {results?.map((entry) => (
            <li key={entry.entryId} className="py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800">{entry.items.map((i) => i.name).join(", ")}</p>
                <p className="text-sm text-gray-500">
                  {niceDate(entry.date)} · {mealLabel(entry.mealType)} · {niceTime(entry.time)}
                  {entry.mood && ` · Mood: ${entry.mood}`}
                  {entry.location && ` · At: ${entry.location}`}
                  {entry.activity && ` · Doing: ${entry.activity}`}
                </p>
              </div>
              <span className="text-gray-700 whitespace-nowrap">{cal(entry.totalCalories)}</span>
              <Link to={`/entries/${entry.entryId}/edit`} aria-label="Edit entry" className="p-2 text-gray-400 hover:text-green-600">
                <Pencil size={16} />
              </Link>
            </li>
          ))}
        </ul>
        {results?.length === 100 && <p className="text-sm text-gray-400 mt-3">Showing the newest 100. Narrow the search to see older ones.</p>}
      </section>
    </div>
  );
}
