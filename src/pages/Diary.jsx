//users diaryscreen
//users ability to write how they felt about the food that day
//the notes are saved by date (one per day) to their account
//entries can be revisited and edited

import { useEffect, useState } from "react";
import { Save, ChevronRight } from "lucide-react";
import { api } from "../api";
import { today, niceDate } from "../dates";
import { card, smallInput, greenButton, errorText } from "../styles";

export default function Diary() {
  const [selectedDate, setSelectedDate] = useState(today);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(""); //what's in the db, to tell if there are unsaved changes
  const [notes, setNotes] = useState([]);
  const [savedMessage, setSavedMessage] = useState("");
  const [error, setError] = useState("");

  //the list on the side
  useEffect(() => {
    api.getNotes().then(setNotes).catch((e) => setError(e.message));
  }, []);

  //load the note for the picked date
  useEffect(() => {
    let stale = false;
    api
      .getNote(selectedDate)
      .then((n) => {
        if (stale) return;
        setNote(n.note);
        setSaved(n.note);
        setSavedMessage("");
      })
      .catch((e) => !stale && setError(e.message));
    return () => {
      stale = true;
    };
  }, [selectedDate]);

  const unsaved = note !== saved;

  function pickDate(d) {
    if (!d || d === selectedDate) return;
    if (unsaved && !window.confirm("You have unsaved changes. Leave this entry without saving?")) return;
    setSelectedDate(d);
  }

  //save the note to the picked date. an empty note deletes it
  async function handleSave() {
    setError("");
    try {
      const res = await api.saveNote(selectedDate, note);
      setNote(res.note);
      setSaved(res.note);
      setNotes(await api.getNotes());
      setSavedMessage(res.note ? "Saved!" : "Entry removed.");
      setTimeout(() => setSavedMessage(""), 2000);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">My Diary</h1>
      <div className="grid md:grid-cols-3 gap-6">
        {/*entry editor*/}
        <div className={`md:col-span-2 ${card} p-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <label htmlFor="diary-date" className="font-semibold text-gray-700">Entry for:</label>
            <input id="diary-date" type="date" value={selectedDate} onChange={(e) => pickDate(e.target.value)} className={`${smallInput} text-gray-700`} />
          </div>

          <textarea name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={10000}
            aria-label="Diary entry"
            placeholder="How was your day? What did you eat? How did you feel?"
            rows={14}
            className="w-full border border-gray-200 rounded-lg p-4 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />

          <div className="flex items-center justify-end gap-3 mt-4">
            {error && <span role="alert" className={errorText}>{error}</span>}
            {savedMessage && <span role="status" className="text-sm text-green-600">{savedMessage}</span>}
            {unsaved && !savedMessage && <span className="text-sm text-gray-400">Unsaved changes</span>}
            <button onClick={handleSave} disabled={!unsaved} className={greenButton}>
              <Save size={18} /> Save Entry
            </button>
          </div>
        </div>

        {/*entries list*/}
        <div className={`md:col-span-1 ${card} p-6`}>
          <h2 className="font-bold text-gray-800 mb-4">Entries</h2>
          {notes.length === 0 ? (
            <p className="text-gray-400 text-sm italic">No entries yet</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.date}>
                  <button
                    onClick={() => pickDate(n.date)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition ${
                      selectedDate === n.date ? "bg-green-50 border border-green-200" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700">{niceDate(n.date)}</p>
                      <p className="text-xs text-gray-400 truncate">{n.preview}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
