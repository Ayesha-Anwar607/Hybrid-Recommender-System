import { useState, useEffect, useCallback } from "react";
import "./AuthPage.css";

// ── Helpers ────────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_BASE_URL || "https://hybrid-recommender-system-z6m4.onrender.com";

/** Simple password-strength score 0-4 */
function pwStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH_COLORS = ["#ff4d6d", "#ff9f43", "#f9ca24", "#63e2b7", "#63e2b7"];
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

// ── Twinkling stars ─────────────────────────────────────────────────────────

function Stars() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    size:  Math.random() * 2.5 + 0.8,
    left:  Math.random() * 100,
    top:   Math.random() * 100,
    dur:   (Math.random() * 4 + 2).toFixed(1),
    delay: (Math.random() * 5).toFixed(1),
    maxOp: (Math.random() * 0.5 + 0.15).toFixed(2),
  }));

  return (
    <div className="auth-stars" aria-hidden="true">
      {stars.map((s) => (
        <div
          key={s.id}
          className="auth-star"
          style={{
            width: s.size,
            height: s.size,
            left: `${s.left}%`,
            top: `${s.top}%`,
            "--dur": `${s.dur}s`,
            "--max-op": s.maxOp,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── LoginForm ───────────────────────────────────────────────────────────────

function LoginForm({ onSuccess, onSwitch }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Please fill in both fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed.");
      // Store token + username
      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("auth_username", username.trim());
      onSuccess(username.trim(), data.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="auth-error" role="alert">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Username */}
      <div className="auth-field">
        <label className="auth-label" htmlFor="login-username">Username</label>
        <div className="auth-input-wrap">
          <input
            id="login-username"
            className={`auth-input${error ? " error" : ""}`}
            type="text"
            placeholder="your_username"
            autoComplete="username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(""); }}
            disabled={loading}
          />
          <i className="ti ti-user auth-input-icon" aria-hidden="true" />
        </div>
      </div>

      {/* Password */}
      <div className="auth-field">
        <label className="auth-label" htmlFor="login-password">Password</label>
        <div className="auth-input-wrap">
          <input
            id="login-password"
            className={`auth-input${error ? " error" : ""}`}
            type={showPw ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            disabled={loading}
          />
          <i className="ti ti-lock auth-input-icon" aria-hidden="true" />
          <button
            type="button"
            className="auth-pw-toggle"
            aria-label={showPw ? "Hide password" : "Show password"}
            onClick={() => setShowPw((v) => !v)}
          >
            <i className={`ti ti-eye${showPw ? "-off" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      <button
        id="login-submit-btn"
        type="submit"
        className="auth-submit-btn"
        disabled={loading}
      >
        {loading && <span className="auth-btn-spinner" />}
        {loading ? "Signing in…" : "Sign In →"}
      </button>

      <p className="auth-switch">
        Don't have an account?{" "}
        <button type="button" onClick={onSwitch}>Create one free</button>
      </p>
    </form>
  );
}

// ── SignupForm ──────────────────────────────────────────────────────────────

function SignupForm({ onSuccess, onSwitch }) {
  const [form, setForm]       = useState({ username: "", email: "", password: "", confirm: "" });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const strength              = pwStrength(form.password);

  function update(field) {
    return (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setError(""); };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const { username, email, password, confirm } = form;

    if (!username.trim() || !email.trim() || !password) {
      setError("Please fill in all fields."); return;
    }
    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(username.trim())) {
      setError("Username: 3-50 chars, letters/numbers/_ only."); return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }
    if (password !== confirm) {
      setError("Passwords don't match."); return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed.");

      // Auto-login right after registration
      const loginRes = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.detail || "Auto-login failed.");

      localStorage.setItem("auth_token", loginData.access_token);
      localStorage.setItem("auth_username", username.trim());
      onSuccess(username.trim(), loginData.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const strengthColor = STRENGTH_COLORS[strength] || STRENGTH_COLORS[0];
  const strengthLabel = STRENGTH_LABELS[strength] || "";

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="auth-error" role="alert">
          <i className="ti ti-alert-circle" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Username */}
      <div className="auth-field">
        <label className="auth-label" htmlFor="signup-username">Username</label>
        <div className="auth-input-wrap">
          <input
            id="signup-username"
            className="auth-input"
            type="text"
            placeholder="cool_username"
            autoComplete="username"
            value={form.username}
            onChange={update("username")}
            disabled={loading}
          />
          <i className="ti ti-user auth-input-icon" aria-hidden="true" />
        </div>
      </div>

      {/* Email */}
      <div className="auth-field">
        <label className="auth-label" htmlFor="signup-email">Email</label>
        <div className="auth-input-wrap">
          <input
            id="signup-email"
            className="auth-input"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={form.email}
            onChange={update("email")}
            disabled={loading}
          />
          <i className="ti ti-mail auth-input-icon" aria-hidden="true" />
        </div>
      </div>

      {/* Password */}
      <div className="auth-field">
        <label className="auth-label" htmlFor="signup-password">
          Password
          {form.password && (
            <span style={{ marginLeft: 8, color: strengthColor, fontWeight: 700, fontSize: 11 }}>
              {strengthLabel}
            </span>
          )}
        </label>
        <div className="auth-input-wrap">
          <input
            id="signup-password"
            className="auth-input"
            type={showPw ? "text" : "password"}
            placeholder="Min. 6 characters"
            autoComplete="new-password"
            value={form.password}
            onChange={update("password")}
            disabled={loading}
          />
          <i className="ti ti-lock auth-input-icon" aria-hidden="true" />
          <button
            type="button"
            className="auth-pw-toggle"
            aria-label={showPw ? "Hide password" : "Show password"}
            onClick={() => setShowPw((v) => !v)}
          >
            <i className={`ti ti-eye${showPw ? "-off" : ""}`} aria-hidden="true" />
          </button>
        </div>
        {form.password && (
          <div className="pw-strength-bar">
            <div
              className="pw-strength-fill"
              style={{
                width: `${(strength / 4) * 100}%`,
                background: strengthColor,
              }}
            />
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div className="auth-field">
        <label className="auth-label" htmlFor="signup-confirm">Confirm Password</label>
        <div className="auth-input-wrap">
          <input
            id="signup-confirm"
            className={`auth-input${form.confirm && form.confirm !== form.password ? " error" : ""}`}
            type={showPw ? "text" : "password"}
            placeholder="Repeat password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={update("confirm")}
            disabled={loading}
          />
          <i className="ti ti-lock-check auth-input-icon" aria-hidden="true" />
        </div>
      </div>

      <button
        id="signup-submit-btn"
        type="submit"
        className="auth-submit-btn"
        disabled={loading}
      >
        {loading && <span className="auth-btn-spinner" />}
        {loading ? "Creating account…" : "Create Account →"}
      </button>

      <p className="auth-switch">
        Already have an account?{" "}
        <button type="button" onClick={onSwitch}>Sign in</button>
      </p>
    </form>
  );
}

// ── AuthPage ────────────────────────────────────────────────────────────────

export default function AuthPage({ onAuthSuccess, initialTab = "login" }) {
  const [tab, setTab] = useState(initialTab); // "login" | "signup"

  // Re-animate card when tab switches
  const [cardKey, setCardKey] = useState(0);
  const switchTab = useCallback((newTab) => {
    setTab(newTab);
    setCardKey((k) => k + 1);
  }, []);

  const isLogin = tab === "login";

  return (
    <div className="auth-page">
      <Stars />

      <div className="auth-card" key={cardKey}>
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">🎬</div>
          <div className="auth-logo-text">
            Cine<span>Match</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="auth-heading">
          {isLogin ? "Welcome back" : "Join CineMatch"}
        </h1>
        <p className="auth-subheading">
          {isLogin
            ? "Sign in to get personalised movie recommendations."
            : "Create your free account to start discovering movies."}
        </p>

        {/* Tab switcher */}
        <div className="auth-tabs" role="tablist">
          <button
            id="tab-login"
            role="tab"
            aria-selected={isLogin}
            className={`auth-tab-btn${isLogin ? " active" : ""}`}
            onClick={() => switchTab("login")}
          >
            Sign In
          </button>
          <button
            id="tab-signup"
            role="tab"
            aria-selected={!isLogin}
            className={`auth-tab-btn${!isLogin ? " active" : ""}`}
            onClick={() => switchTab("signup")}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        {isLogin ? (
          <LoginForm
            onSuccess={onAuthSuccess}
            onSwitch={() => switchTab("signup")}
          />
        ) : (
          <SignupForm
            onSuccess={onAuthSuccess}
            onSwitch={() => switchTab("login")}
          />
        )}
      </div>
    </div>
  );
}
