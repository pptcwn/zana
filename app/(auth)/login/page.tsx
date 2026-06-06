"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-strong w-full max-w-sm p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl btn-primary text-2xl shadow-md">
            ✿
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-rose-gold">ZANA</h1>
          <p className="text-sm text-muted-foreground mt-1.5 tracking-wide">E-Commerce &amp; CRM</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
              อีเมล
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="input-luxe"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
              รหัสผ่าน
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input-luxe"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full btn-primary rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 mt-2"
          >
            {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
