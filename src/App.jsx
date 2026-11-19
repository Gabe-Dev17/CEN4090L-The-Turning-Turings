import { lazy, Suspense, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import AddFood from "./pages/AddFood";
import Lookup from "./pages/Lookup";
import History from "./pages/History";
import Diary from "./pages/Diary";
import Navbar from "./components/Navbar";
import Reminder from "./components/Reminder";
import { api, getToken, setToken, LOGIN_PAGE } from "./api";

//the charts library is big, so the progress page only loads when it's opened
const Progress = lazy(() => import("./pages/Progress"));

const loadingText = <p className="text-gray-400 text-center py-16">Loading...</p>;

export default function App() {
  const [user, setUser] = useState(null);

  //check the saved token on load. no token (or an expired one) goes to the login page
  useEffect(() => {
    if (!getToken()) {
      window.location.replace(LOGIN_PAGE);
      return;
    }
    api.me()
      .then(setUser)
      //a 401 (expired token) already went to the login page in api.js
      .catch((err) => {
        if (err.status === 401) return;
        setToken(null);
        window.location.replace(LOGIN_PAGE);
      });

    //the browser's Back button can show a saved copy of this page after logging out
    //without running the check above, so check again whenever the page is shown
    const recheck = () => {
      if (!getToken()) window.location.replace(LOGIN_PAGE);
    };
    window.addEventListener("pageshow", recheck);
    return () => window.removeEventListener("pageshow", recheck);
  }, []);

  const logout = () => {
    setToken(null);
    //replace, so Back doesn't go to the page you just logged out of
    window.location.replace(LOGIN_PAGE);
  };

  if (!user) return <div className="min-h-screen bg-gray-50">{loadingText}</div>;

  //any unknown link goes to Home
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar user={user} onLogout={logout} />
        <Reminder user={user} />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <Suspense fallback={loadingText}>
            <Routes>
              <Route path="/" element={<Home user={user} />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/add" element={<AddFood />} />
              <Route path="/lookup" element={<Lookup />} />
              <Route path="/entries/:id/edit" element={<Lookup />} />
              <Route path="/history" element={<History />} />
              <Route path="/diary" element={<Diary />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        {/*usda asks apps that use their data to credit it*/}
        <footer className="text-center text-xs text-gray-400 pb-6">
          Nutrition data: U.S. Department of Agriculture, FoodData Central.
        </footer>
      </div>
    </BrowserRouter>
  );
}
