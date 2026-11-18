//login and signup screen
//mode is "login" or "signup"
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setToken } from "../api";

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isStrongPassword = (s) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(s);

export default function Login({ mode = "login", onLogin }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");

  const validate = () => {
    const errs = {};
    if (isSignup && !name.trim()) errs.name = "Enter your name.";
    if (!isEmail(email.trim())) errs.email = "Enter a valid email.";
    if (isSignup) {
      if (!isStrongPassword(password)) errs.password = "Use 8+ characters with a letter and a number.";
      else if (password !== confirm) errs.confirm = "Passwords don't match.";
    } else if (!password) {
      errs.password = "Enter your password.";
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      const { token, user } = isSignup
        ? await api.register(name.trim(), email.trim(), password)
        : await api.login(email.trim(), password);
      setToken(token);
      onLogin(user);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  const inputClass =
    "w-full border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-500";
  const fieldError = (key) =>
    fieldErrors[key] && <p className="text-sm text-red-500 mt-1">{fieldErrors[key]}</p>;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md space-y-4"
      >
        <h1 className="text-3xl font-bold text-gray-800">Calorie Tracker</h1>
        <p className="text-gray-500">{isSignup ? "Create an account" : "Log in to your account"}</p>

        {isSignup && (
          <div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputClass} />
            {fieldError("name")}
          </div>
        )}
        <div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputClass} />
          {fieldError("email")}
        </div>
        <div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className={inputClass} />
          {fieldError("password")}
        </div>
        {isSignup && (
          <div>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm Password" className={inputClass} />
            {fieldError("confirm")}
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button className="w-full bg-green-500 text-white py-3 rounded-lg font-medium hover:bg-green-600 transition">
          {isSignup ? "Create Account" : "Log In"}
        </button>

        <p className="text-sm text-center text-gray-500">
          {isSignup ? "Have an account? " : "No account? "}
          <Link to={isSignup ? "/login" : "/signup"} className="text-green-600 font-medium hover:underline">
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </form>
    </div>
  );
}
