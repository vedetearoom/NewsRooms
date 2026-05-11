"use client";

import * as React from "react";
import { X, AlertCircle, CheckCircle2 } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

let subscribers: ((toast: Toast) => void)[] = [];

export const toast = {
  error: (title: string, description?: string) => {
    const t = { id: Math.random().toString(), title, description, type: "error" as ToastType };
    subscribers.forEach(s => s(t));
  },
  success: (title: string, description?: string) => {
    const t = { id: Math.random().toString(), title, description, type: "success" as ToastType };
    subscribers.forEach(s => s(t));
  },
  info: (title: string, description?: string) => {
    const t = { id: Math.random().toString(), title, description, type: "info" as ToastType };
    subscribers.forEach(s => s(t));
  }
};

export function Toaster() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  React.useEffect(() => {
    const handler = (t: Toast) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, 5000);
    };
    subscribers.push(handler);
    return () => { subscribers = subscribers.filter(s => s !== handler); };
  }, []);

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3">
      {toasts.map(t => (
        <div key={t.id} className={`relative flex gap-3 shadow-xl rounded-xl animate-in slide-in-from-right-8 fade-in ${t.type === 'info' ? 'w-fit min-w-[120px] justify-center px-6 py-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 items-center' : `w-[320px] p-4 bg-[#fcfcfc] dark:bg-[#1a1b1e] border border-zinc-200/80 dark:border-white/10 ${t.description ? 'items-start' : 'items-center'}`}`}>
          {t.type === "error" && <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
          {t.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
          <div className={t.type === "info" ? "flex-1 text-center" : "flex-1"}>
            <h4 className={`text-[13px] font-medium tracking-tight ${t.type === "info" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>{t.title}</h4>
            {t.description && <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{t.description}</p>}
          </div>
          {t.type !== 'info' && (
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="text-muted-foreground hover:text-foreground shrink-0 outline-none">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
