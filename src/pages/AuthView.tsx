import { useId, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { login } from "../services/api";
import { AskDemo } from "../components/shared/AskDemo";
import "./AuthView.css";

type UserRole = 'super_admin' | 'project_user';

interface AuthViewProps {
  onAuthenticated: (user: { name: string; email: string; role: UserRole }) => void;
  isDark: boolean;
  onThemeToggle: () => void;
}

type FieldErrors = { username?: string; password?: string };

const EASE = [0.28, 0.11, 0.32, 1] as const;

export function AuthView({ onAuthenticated, isDark, onThemeToggle }: AuthViewProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const ids = { user: useId(), pass: useId(), userErr: useId(), passErr: useId(), caps: useId() };

  // The role picker is hidden for now; everyone signs in as a project user.
  const userRole: UserRole = "project_user";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const errors: FieldErrors = {};
    if (!username.trim()) errors.username = "Enter your username.";
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    setFormError(null);
    if (errors.username || errors.password) {
      (errors.username ? usernameRef : passwordRef).current?.focus();
      setShakeKey((k) => k + 1);
      return;
    }

    setIsLoading(true);
    try {
      const result = await login({ username: username.trim(), password });

      if (result.success && result.data) {
        toast.success("Welcome back!");
        onAuthenticated({
          name: result.data.user.name || result.data.user.username,
          email: result.data.user.email,
          role: userRole,
        });
      } else {
        setFormError(result.error?.message || "That username and password don't match. Try again.");
        setShakeKey((k) => k + 1);
        passwordRef.current?.select();
      }
    } catch (error: any) {
      setFormError(error?.message || "We couldn't reach the server. Check your connection and try again.");
      setShakeKey((k) => k + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const trackCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState?.("CapsLock") ?? false);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="auth">
        <section className="auth-stage" aria-hidden="true">
          <motion.div
            className="auth-stage-copy"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <p className="auth-eyebrow">VizAI</p>
            <h2 className="auth-hero">Ask your data anything.</h2>
            <p className="auth-lead">
              Plain-language questions in. Charts and dashboards out.
            </p>
          </motion.div>
          <motion.div
            className="auth-demo-wrap"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.25, ease: EASE }}
          >
            <AskDemo />
          </motion.div>
        </section>

        <section className="auth-panel">
          <button
            type="button"
            className="auth-theme"
            onClick={onThemeToggle}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDark ? "sun" : "moon"}
                initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="auth-theme-icon"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </motion.span>
            </AnimatePresence>
          </button>

          <motion.div
            className="auth-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          >
            <img className="auth-logo" src="/favicon.svg" alt="" width={56} height={56} />
            <h1 className="auth-title">Sign in to VizAI</h1>
            <p className="auth-subtitle">Use your workspace account.</p>

            <motion.form
              key={shakeKey}
              onSubmit={handleLogin}
              noValidate
              className="auth-form"
              animate={shakeKey ? { x: [0, -8, 8, -5, 5, 0] } : undefined}
              transition={{ duration: 0.4 }}
            >
              <AnimatePresence>
                {formError && (
                  <motion.div
                    role="alert"
                    className="auth-alert"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                  >
                    <div className="auth-alert-inner">
                      <AlertCircle size={16} aria-hidden="true" />
                      <span>{formError}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="auth-field">
                <label htmlFor={ids.user} className="auth-label">Username</label>
                <input
                  ref={usernameRef}
                  id={ids.user}
                  className="auth-input"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (fieldErrors.username) setFieldErrors((f) => ({ ...f, username: undefined }));
                  }}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  disabled={isLoading}
                  aria-invalid={Boolean(fieldErrors.username)}
                  aria-describedby={fieldErrors.username ? ids.userErr : undefined}
                />
                <FieldMessage id={ids.userErr} message={fieldErrors.username} />
              </div>

              <div className="auth-field">
                <label htmlFor={ids.pass} className="auth-label">Password</label>
                <div className="auth-input-wrap">
                  <input
                    ref={passwordRef}
                    id={ids.pass}
                    className="auth-input auth-input--with-action"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
                    }}
                    onKeyDown={trackCapsLock}
                    onKeyUp={trackCapsLock}
                    onBlur={() => setCapsLockOn(false)}
                    autoComplete="current-password"
                    disabled={isLoading}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={
                      [fieldErrors.password && ids.passErr, capsLockOn && ids.caps].filter(Boolean).join(" ") ||
                      undefined
                    }
                  />
                  <button
                    type="button"
                    className="auth-input-action"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <FieldMessage id={ids.passErr} message={fieldErrors.password} />
                <AnimatePresence>
                  {capsLockOn && (
                    <motion.p
                      id={ids.caps}
                      className="auth-hint"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      Caps Lock is on.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <button type="submit" className="auth-submit" disabled={isLoading}>
                <AnimatePresence mode="wait" initial={false}>
                  {isLoading ? (
                    <motion.span
                      key="loading"
                      className="auth-submit-content"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Loader2 size={18} className="auth-spin" aria-hidden="true" />
                      Signing in…
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      className="auth-submit-content"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      Continue
                      <ArrowRight size={18} aria-hidden="true" className="auth-submit-arrow" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </motion.form>

            <button
              type="button"
              className="auth-link"
              onClick={() => toast.info("Ask your workspace admin to reset your password.")}
            >
              Forgot password?
            </button>
          </motion.div>

          <p className="auth-legal">Your data stays in your databases. VizAI only reads what you ask about.</p>
        </section>
      </div>
    </MotionConfig>
  );
}

function FieldMessage({ id, message }: { id: string; message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          id={id}
          className="auth-error"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
