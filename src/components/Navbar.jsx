//navbar
//title, home, progress, add, lookup, history, diary, log out
import { NavLink } from "react-router-dom";
import { Home, TrendingUp, Plus, Search, History, BookOpen, LogOut, Apple } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/add", label: "Add", icon: Plus },
  { to: "/lookup", label: "Lookup", icon: Search },
  { to: "/history", label: "History", icon: History },
  { to: "/diary", label: "Diary", icon: BookOpen },
];

export default function Navbar({ user, onLogout }) {
  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition ${
      isActive ? "bg-green-500 text-white" : "text-gray-600 hover:bg-green-100"
    }`;

  //User.logout: forget the token and go to the login page
  const logout = () => onLogout();

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-green-500 text-white p-2 rounded-lg">
            <Apple size={18} />
          </div>
          <div className="leading-tight">
            <span className="block text-xl font-bold text-gray-800">Plateful</span>
            <span className="block text-xs text-gray-500">Calorie Tracker</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={linkClass} aria-label={label} title={label}>
              <Icon size={18} />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
          <button
            onClick={logout}
            title={`Log out ${user.displayName}`}
            aria-label="Log out"
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
}
