// for the backend
/* exported Auth */ // used by app.js

const AUTH_CONFIG = {
    USE_BACKEND: true,
    API_BASE: "",                        // same server as this page (express, or vite's /api proxy in dev)
    DASHBOARD_URL: "/",                  // the react app (Home)
    LOGIN_URL: "/login/index.html",
};

/* ------------------------------------------------------------
   API – the express server (server/routes.js)

   POST /api/auth/register   body: { name, email, password }
     201 → { token, user: { userId, email, displayName } }
     409 → { error: "An account with this email already exists.", field: "email" }
     400 → { error: "...", field: "name" | "email" | "password" }

   POST /api/auth/login      body: { email, password }
     200 → { token, user: { userId, email, displayName } }
     401 → { error: "Email or password is incorrect." }

   GET  /api/me              header: Authorization: Bearer <token>
     200 → the user, 401 if the token is missing or expired

   the token is kept in localStorage ("token"), where the react app (src/api.js)
   reads it too. logging out is just forgetting it.
   backendAuth below turns these into the { ok, user: { name, email } }
   shape the rest of this page already uses
   ------------------------------------------------------------ */

const TOKEN_KEY = "token";

// the server calls it displayName, this page calls it name
function toUser(data) {
    const user = data && (data.user || data);
    return user && user.email ? { name: user.displayName, email: user.email } : null;
}

//  Real backend
async function apiRequest(path, method = "GET", body) {
    const token = localStorage.getItem(TOKEN_KEY);
    try {
        const response = await fetch(AUTH_CONFIG.API_BASE + path, {
            method,
            headers: {
                ...(body && { "Content-Type": "application/json" }),
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await response.json().catch(() => null);
        // no JSON back means the request never reached our server (in dev, Vite answers 500 when the backend isn't running)
        if (!data && response.status >= 500) return { ok: false, message: "Can’t reach the server. Check that it’s running and try again." };
        if (response.ok) return { ok: true, user: toUser(data), token: data?.token };
        return { ok: false, status: response.status, message: data?.error || "Something went wrong. Try again.", field: data?.field };
    } catch {
        return { ok: false, message: "Can’t reach the server. Check that it’s running and try again." };
    }
}

const backendAuth = {
    // the server sends a token when you register, but this page sends you to the
    // Log in tab next, so it isn't kept
    registerUser: ({ name, email, password }) => apiRequest("/api/auth/register", "POST", { name, email, password }),
    loginUser: async (info) => {
        const result = await apiRequest("/api/auth/login", "POST", info);
        if (result.ok) localStorage.setItem(TOKEN_KEY, result.token);
        return result;
    },
    getCurrentUser: async () => {
        if (!localStorage.getItem(TOKEN_KEY)) return null;
        const result = await apiRequest("/api/me");
        if (!result.ok && result.status === 401) localStorage.removeItem(TOKEN_KEY); // expired
        return result.ok ? result.user : null;
    },
    logoutUser: async () => {
        localStorage.removeItem(TOKEN_KEY);
        return { ok: true };
    },
};

//  Test mode (localStorage) - only used if USE_BACKEND is false.
//  accounts made here only exist in this browser and can't use the rest of the app
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
