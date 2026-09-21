"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage("Supabase authentication is not configured yet.");
      return;
    }

    setIsLoading(true);
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setMessage(result.error.message);
    } else if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
    } else {
      router.replace("/");
      router.refresh();
    }

    setIsLoading(false);
  };

  const signInWithGitHub = async () => {
    setMessage("");
    if (!supabase) {
      setMessage("Supabase authentication is not configured yet.");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setMessage(error.message);
      setIsLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark auth-brand"><span>H</span><strong>HelloAI</strong></div>
        <span className="eyebrow">YOUR AI WORKSPACE</span>
        <h1>{mode === "login" ? "Welcome back." : "Start building."}</h1>
        <p className="auth-intro">Sign in to create projects, generate content, and keep your work available across devices.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
          {message && <p className="auth-message">{message}</p>}
          <button className="primary-button" type="submit" disabled={isLoading}>{isLoading ? "Please wait..." : mode === "login" ? "Sign in  →" : "Create account  →"}</button>
          {mode === "login" && <button className="secondary-button" type="button" onClick={signInWithGitHub} disabled={isLoading}>Continue with GitHub</button>}
        </form>
        <button className="auth-switch" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>{mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}</button>
      </section>
    </main>
  );
}
