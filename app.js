// validation
function  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

}

function isStrongPassword(pw) {
    return pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

function setFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    document.getElementById(inputId + "-error").textContent = message;
    input.setAttribute("aria-invalid", message? "true" : "false");
    return !message;
}

function setFormMessage(id, text, isSuccess = false) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.classList.toggle("success", isSuccess);
}

// Disable login button while loading so user cannot double-submit
function setBusy(form, busy, busyText){
    const button = form.querySelector(".primary");
    if (!button.dataset.label) button.dataset.label = "button.textContent"
    button.disabled = busy;
    button.textContent = busy ? busyText : button.dataset.label;
}

// Tabs
function showForm(name) {
    const isLogin = name === "login";
    document.getElementById("login-form").hidden = !isLogin;
    document.getElementById("register-form").hidden = isLogin;
    document.getElementById("tab-login").setAttribute("aria-selected", isLogin);
    document.getElementById("tab-register").setAttribute("aria-selected", !isLogin);
    document.title = isLogin ? "Plateful – Log in" : "Plateful – Create account";
}

// Register
async function handleRegister(event) {
    event.preventDefault();
    const form = event.target;
    setFormMessage("register-message", "");

    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim().toLowerCase();
    const password = document.getElementById("reg-password").value;
    const confirm = document.getElementById("reg-confirm").value;

    const ok = [
        setFieldError("reg-name", name ? "" : "Enter your name."),
        setFieldError("reg-email", isValidEmail(email) ? "" : "Enter an email like name@example.com."),
        setFieldError("reg-password", isStrongPassword(password) ? "" : "Use 8+ characters with a letter and a number."),
        setFieldError("reg-confirm", confirm && confirm === password ? "" : "Passwords don’t match."),
    ].every(Boolean);
    if (!ok) return;

    setBusy(form, true, "Creating account…");
    const result = await Auth.registerUser({ name, email, password });
    setBusy(form, false);

    if (!result.ok) {
        // Show the error next to the field the server named, if any
        const fieldIds = { name: "reg-name", email: "reg-email", password: "reg-password" };
        if (result.field && fieldIds[result.field]) setFieldError(fieldIds[result.field], result.message);
        else setFormMessage("register-message", result.message);
        return;
    }

    form.reset();
    showForm("login");
    document.getElementById("login-email").value = email;
    setFormMessage("login-message", "Account created. Log in to continue.", true);
    document.getElementById("login-password").focus();
}

//Login

async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    setFormMessage("login-message", "");

    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;

    const ok = [
        setFieldError("login-email", isValidEmail(email) ? "" : "Enter your email."),
        setFieldError("login-password", password ? "" : "Enter your password."),
    ].every(Boolean);
    if (!ok) return;

    setBusy(form, true, "Logging in…");
    const result = await Auth.loginUser({ email, password });
    setBusy(form, false);

    if (!result.ok) {
        setFormMessage("login-message", result.message);
        return;
    }
    window.location.href = AUTH_CONFIG.DASHBOARD_URL;
}

// Show/hide password
function togglePassword(button) {
    const input = document.getElementById(button.dataset.target);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Show": "Hide";
}

// Page Setup
async function initAuthPage() {
    // Already logged in? Skip straight to the dashboard
    if (await Auth.getCurrentUser()) {
        window.location.href = AUTH_CONFIG.DASHBOARD_URL;
        return;
    }

    document.getElementById("tab-login").addEventListener("click", () => showForm("login"));
    document.getElementById("tab-register").addEventListener("click", () => showForm("register"));
    document.querySelectorAll("[data-show]").forEach(btn =>
        btn.addEventListener("click", () => showForm(btn.dataset.show))
    );
    document.querySelectorAll(".show-btn").forEach(btn =>
        btn.addEventListener("click", () => togglePassword(btn))
    );

    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("register-form").addEventListener("submit", handleRegister);
}


// Placeholder dashboard (delete once hooked to Dunya's dashboard)
async function initDashboardPage() {
    const user = await Auth.getCurrentUser();
    if (!user) {
        window.location.href = AUTH_CONFIG.LOGIN_URL;
        return;
    }
    document.getElementById("user-name").textContent = user.name;
    document.getElementById("logout").addEventListener("click", async () => {
        await Auth.logoutUser();
        window.location.href = AUTH_CONFIG.LOGIN_URL;
    });
}

const page = document.body.dataset.page;
if (page === "auth") initAuthPage();
if (page === "dashboard") initDashboardPage();
