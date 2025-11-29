import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: number; title: string; description?: string; type?: ToastType };

const ToastContext = createContext<{ toast: (t: Omit<ToastItem, 'id'>) => void } | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((t: Omit<ToastItem, 'id'>) => {
    setToasts((s) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      return [...s, { id, ...t }];
    });
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => {
        setToasts((s) => s.filter((x) => x.id !== t.id));
      }, 4000)
    );
    return () => timers.forEach((id) => clearTimeout(id));
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-xs w-full rounded-md p-3 shadow-md border ${
              t.type === 'success' ? 'bg-green-50 border-green-200' : t.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="font-medium text-sm">{t.title}</div>
            {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return {
    success: (title: string, description?: string) => ctx.toast({ title, description, type: 'success' }),
    error: (title: string, description?: string) => ctx.toast({ title, description, type: 'error' }),
    info: (title: string, description?: string) => ctx.toast({ title, description, type: 'info' }),
  };
}

export default ToastContext;
