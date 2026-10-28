//users diaryscreen
//users ability to add the way they felt about the food to the diary tab
//the user is able to add as many characters as they want
//the notes are saved by month/day/year
//entries can be revisited and edited

import { useState, useEffect } from "react";
import { BookOpen, Calendar, Save, ChevronRight } from "lucide-react";

export default function Diary() {
  //todays date in year-month-day 
  const todayStr = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [note, setNote] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  //save all diary entries to localStorage
  const [allEntries, setAllEntries] = useState(() => {
    const saved = localStorage.getItem("diaryEntries");
    return saved ? JSON.parse(saved) : {};
  });

  //loading the picked date notes
  useEffect(() => {
    setNote(allEntries[selectedDate] || "");
    setSavedMessage("");
  }, [selectedDate, allEntries]);

  //save the current note to selected date
  const handleSave = () => {
    const updated = { ...allEntries, [selectedDate]: note };
    //if empty delete note
    if (!note.trim()) {
      delete updated[selectedDate];
    }
    setAllEntries(updated);
    localStorage.setItem("diaryEntries", JSON.stringify(updated));
    setSavedMessage("Saved!");
    setTimeout(() => setSavedMessage(""), 2000);
  };

  //sort notes by newest date
  const sortedDates = Object.keys(allEntries).sort(
    (a, b) => new Date(b) - new Date(a)
  );

  //format date ex-Mon, Oct 28, 2026
  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold text-gray-800">My Diary</h1>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {/*entry editor */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-gray-700">
                Entry for:
              </label>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How was your day? What did you eat? How did you feel?"
            rows={14}
            className="w-full border border-gray-200 rounded-lg p-4 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              {savedMessage && (
                <span className="text-sm text-green-600 font-medium">
                  {savedMessage}
                </span>
              )}
              <button
                onClick={handleSave}
                className="bg-green-500 text-white px-5 py-2 rounded-lg font-medium hover:bg-green-600 transition flex items-center gap-2"
              >
                <Save size={18} /> Save Entry
              </button>
            </div>
          </div>
        </div>

        {/*entries list*/}
        <div className="md:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4">Entries</h2>
          {sortedDates.length === 0 ? (
            <p className="text-gray-400 text-sm italic">
              No entries yet
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedDates.map((date) => (
                <li key={date}>
                  <button
                    onClick={() => setSelectedDate(date)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition ${
                      selectedDate === date
                        ? "bg-green-50 border border-green-200"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        {formatDate(date)}
                      </p>
                      <p className="text-xs text-gray-400 truncate max-w-[180px]">
                        {allEntries[date].slice(0, 40)}
                        {allEntries[date].length > 40 ? "..." : ""}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
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