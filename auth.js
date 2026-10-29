// for the backend

const AUTH_CONFIG = {
    USE_BACKEND: false,
    API_BASE: "http://localhost:5000",  // where the Python server runs
    DASHBOARD_URL: "dashboard.html",     // change to your Dunya's dashboard page
    LOGIN_URL: "index.html",
};

/* ------------------------------------------------------------
   API CONTRACT – backend team

   POST /api/register   body: { name, email, password }
     201 → { user: { name, email } }
     409 → { error: "An account with this email already exists.", field: "email" }
     400 → { error: "...", field: "name" | "email" | "password" }

   POST /api/login      body: { email, password }
     200 → { user: { name, email } }      (server also sets a session cookie)
     401 → { error: "Email or password is incorrect." }

   GET  /api/me
     200 → { user: { name, email } }
     401 → not logged in

   POST /api/logout
     200 → {}
   ------------------------------------------------------------ */

//  Real backend
async function apiRequest(path, method = "GET", body) {
    try {
        const response = await fetch(AUTH_CONFIG.API_BASE + path, {
            method,
            headers: body ? { "Content-Type": "application/json" } : {},
            body: body ? JSON.stringify(body) : undefined,
            credentials: "include", // send/receive the session cookie
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) return { ok: true, ...data };
        return { ok: false, message: data.error || "Something went wrong. Try again.", field: data.field };
    } catch {
        return { ok: false, message: "Can’t reach the server. Check that it’s running and try again." };
    }
}

const backendAuth = {
    registerUser: (info) => apiRequest("/api/register", "POST", info),
    loginUser: (info) => apiRequest("/api/login", "POST", info),
    getCurrentUser: async () => {
        const result = await apiRequest("/api/me");
        return result.ok ? result.user : null;
    },
    logoutUser: () => apiRequest("/api/logout", "POST"),
};

//  Test mode (localStorage)
const USERS_KEY = "plateful.users";
const SESSION_KEY = "plateful.session";

function readJSON(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
}

function toHex(bytes) {
    return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + password));
    return toHex(new Uint8Array(digest));
}

const mockAuth = {
    async registerUser({ name, email, password }) {
        const users = readJSON(USERS_KEY, {});
        if (users[email]) {
            return { ok: false, field: "email", message: "An account with this email already exists. Log in instead." };
        }
        const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
        users[email] = { name, email, salt, passwordHash: await hashPassword(password, salt) };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        return { ok: true, user: { name, email } };
    },

    async loginUser({ email, password }) {
        const user = readJSON(USERS_KEY, {})[email];
        if (!user || (await hashPassword(password, user.salt)) !== user.passwordHash) {
            return { ok: false, message: "Email or password is incorrect." };
        }
        localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name, email }));
        return { ok: true, user: { name: user.name, email } };
    },

    async getCurrentUser() {
        return readJSON(SESSION_KEY, null);
    },

    async logoutUser() {
        localStorage.removeItem(SESSION_KEY);
        return { ok: true };
    },
};

// Pick the mode
const Auth = AUTH_CONFIG.USE_BACKEND ? backendAuth : mockAuth;
