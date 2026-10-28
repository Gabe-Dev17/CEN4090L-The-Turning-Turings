//navbar
//title,home,progress,add,lookup,diary
import { NavLink } from "react-router-dom";
import { Home, TrendingUp, Plus, Search, BookOpen } from "lucide-react";

export default function Navbar() {
  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
      isActive
        ? "bg-green-500 text-white"
        : "text-gray-600 hover:bg-green-100"
    }`;

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-green-500 text-white p-2 rounded-lg">
          </div>
          <span className="text-xl font-bold text-gray-800">Calorie Tracker</span>
        </div>

        <div className="flex gap-2">
          <NavLink to="/" className={linkClass}>
            <Home size={18} />
            <span className="hidden sm:inline">Home</span>
          </NavLink>
          <NavLink to="/progress" className={linkClass}>
            <TrendingUp size={18} />
            <span className="hidden sm:inline">Progress</span>
          </NavLink>
          <NavLink to="/add" className={linkClass}>
            <Plus size={18} />
            <span className="hidden sm:inline">Add</span>
          </NavLink>
          <NavLink to="/lookup" className={linkClass}>
            <Search size={18} />
            <span className="hidden sm:inline">Lookup</span>
          </NavLink>
          <NavLink to="/diary" className={linkClass}>
            <BookOpen size={18} />
            <span className="hidden sm:inline">Diary</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}