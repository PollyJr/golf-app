"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DEFAULT_TIME_ZONE } from "@/lib/format";
import { createTranslator, type Locale } from "@/lib/i18n/core";
import { dictionaries, type AppTranslate } from "@/lib/i18n/dictionaries";
import { ApiError } from "@/lib/api-client";

// ------------------------------------------------------------------ i18n --

interface AppContextValue {
  locale: Locale;
  timeZone: string;
  t: AppTranslate;
}

const AppContext = createContext<AppContextValue | null>(null);

function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppProviders is missing from the tree");
  return value;
}

/** The translator for the visitor's language. */
export function useT(): AppTranslate {
  return useApp().t;
}

export function useLocale(): Locale {
  return useApp().locale;
}

/** Locale and club time zone, for formatting dates the same way as the server. */
export function useFormat(): { locale: Locale; timeZone: string } {
  const { locale, timeZone } = useApp();
  return { locale, timeZone };
}

/** Turns an API error into a sentence in the visitor's language. */
export function useErrorMessage(): (error: unknown) => string {
  const t = useT();
  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiError) {
        const key = `common.errors.${error.code}`;
        const message = (t as (key: string) => string)(key);
        return message === key ? t("common.errors.UNKNOWN") : message;
      }
      return t("common.errors.NETWORK");
    },
    [t],
  );
}

// ----------------------------------------------------------------- toast --

type ToastTone = "success" | "error";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error("AppProviders is missing from the tree");
  return value;
}

const TOAST_MS = 4200;

function Toasts({ items, dismiss }: { items: ToastItem[]; dismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-pop animate-rise",
            item.tone === "success" ? "border-transparent bg-brand text-brand-ink" : "border-danger/30 bg-danger-soft text-danger",
          )}
        >
          {item.tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
          <span className="min-w-0 flex-1">{item.message}</span>
          <button type="button" onClick={() => dismiss(item.id)} className="-mr-1 opacity-70 hover:opacity-100" aria-label="×">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------- providers --

interface AppProvidersProps {
  locale: Locale;
  timeZone?: string;
  children: ReactNode;
}

export function AppProviders({ locale, timeZone = DEFAULT_TIME_ZONE, children }: AppProvidersProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      setToasts((items) => [...items.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );

  const app = useMemo<AppContextValue>(
    () => ({ locale, timeZone, t: createTranslator(dictionaries[locale], locale) }),
    [locale, timeZone],
  );
  const toast = useMemo<ToastApi>(
    () => ({ success: (message) => push("success", message), error: (message) => push("error", message) }),
    [push],
  );

  return (
    <AppContext.Provider value={app}>
      <ToastContext.Provider value={toast}>
        {children}
        <Toasts items={toasts} dismiss={dismiss} />
      </ToastContext.Provider>
    </AppContext.Provider>
  );
}
