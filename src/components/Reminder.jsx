//the meal reminder. a web page can only remind you while it's open, so this
//checks every 30 seconds and shows a banner (and a browser notification if allowed)
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "../api";
import { today, niceTime } from "../dates";

export default function Reminder({ user }) {
  const [time, setTime] = useState(null);
  const [show, setShow] = useState(false);
  const since = useRef(0);

  //the progress page fires "goal-changed" when the reminder time is saved
  useEffect(() => {
    const load = () => api.getGoal(today()).then((g) => setTime(g?.reminderTime ?? null)).catch(() => {});
    load();
    window.addEventListener("goal-changed", load);
    return () => window.removeEventListener("goal-changed", load);
  }, []);

  useEffect(() => {
    if (!time) return;
    //only times reached while the app is open count, so setting 8:00 at noon doesn't pop up right away
    since.current = Date.now();
    const key = `reminder-shown-${user.userId}`;

    const check = () => {
      const [h, m] = time.split(":").map(Number);
      const due = new Date();
      due.setHours(h, m, 0, 0);
      if (Date.now() < due.getTime() || due.getTime() < since.current) return;
      //date + time so it fires once a day, and again if the time is changed
      const stamp = `${today()} ${time}`;
      try {
        if (localStorage.getItem(key) === stamp) return;
        localStorage.setItem(key, stamp);
      } catch {
        //storage blocked, the reminder might just repeat
      }
      setShow(true);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Plateful", { body: `It's ${niceTime(time)}. Time to log your meals.`, icon: "/favicon.svg" });
      }
    };

    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [time, user.userId]);

  if (!show) return null;
  return (
    <div role="status" className="bg-green-50 border-b border-green-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 text-green-800">
        <Bell size={18} />
        <span className="font-medium">It's {niceTime(time)}. Time to log your meals.</span>
        <Link to="/lookup" onClick={() => setShow(false)} className="bg-green-500 text-white text-sm px-3 py-1 rounded-lg hover:bg-green-600 transition">
          Log food
        </Link>
        <button onClick={() => setShow(false)} className="text-sm text-green-700 hover:underline">Dismiss</button>
      </div>
    </div>
  );
}
