import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react';

export type AppToastType = 'success' | 'info' | 'warning' | 'error';

export type AppToastInput = {
  type: AppToastType;
  title: string;
  message?: string;
  duration?: number;
};

type AppToastRecord = AppToastInput & {
  id: string;
};

type AppToastContextValue = {
  showToast: (toast: AppToastInput) => string;
  dismissToast: (id: string) => void;
  success: (title: string, message?: string, duration?: number) => string;
  info: (title: string, message?: string, duration?: number) => string;
  warning: (title: string, message?: string, duration?: number) => string;
  error: (title: string, message?: string, duration?: number) => string;
};

const AppToastContext = createContext<AppToastContextValue | null>(null);

const DEFAULT_DURATION: Record<AppToastType, number> = {
  success: 3800,
  info: 4500,
  warning: 5200,
  error: 6000,
};

const toastTheme: Record<
  AppToastType,
  {
    card: string;
    iconWrap: string;
    icon: typeof CheckCircle2;
    label: string;
  }
> = {
  success: {
    card: 'border-emerald-200 bg-emerald-100 text-emerald-950',
    iconWrap: 'text-emerald-800',
    icon: CheckCircle2,
    label: 'Success',
  },
  info: {
    card: 'border-sky-200 bg-sky-100 text-sky-950',
    iconWrap: 'text-sky-800',
    icon: Info,
    label: 'Info',
  },
  warning: {
    card: 'border-amber-200 bg-amber-100 text-amber-950',
    iconWrap: 'text-amber-800',
    icon: TriangleAlert,
    label: 'Warning',
  },
  error: {
    card: 'border-rose-200 bg-rose-100 text-rose-950',
    iconWrap: 'text-rose-800',
    icon: CircleAlert,
    label: 'Error',
  },
};

function makeToastId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AppToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<AppToastRecord[]>([]);
  const timersRef = useRef(new Map<string, number>());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (input: AppToastInput) => {
      const id = makeToastId();
      const cleanTitle = input.title.trim() || toastTheme[input.type].label;
      const cleanMessage = input.message?.trim() || '';
      const duration =
        typeof input.duration === 'number' && input.duration > 0
          ? input.duration
          : DEFAULT_DURATION[input.type];

      const nextToast: AppToastRecord = {
        ...input,
        id,
        title: cleanTitle,
        message: cleanMessage,
        duration,
      };

      setToasts((current) => [...current.slice(-2), nextToast]);

      const timer = window.setTimeout(() => {
        dismissToast(id);
      }, duration);

      timersRef.current.set(id, timer);
      return id;
    },
    [dismissToast],
  );

  useEffect(() => {
    const timers = timersRef.current;

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = useMemo<AppToastContextValue>(
    () => ({
      showToast,
      dismissToast,
      success: (title, message, duration) =>
        showToast({ type: 'success', title, message, duration }),
      info: (title, message, duration) =>
        showToast({ type: 'info', title, message, duration }),
      warning: (title, message, duration) =>
        showToast({ type: 'warning', title, message, duration }),
      error: (title, message, duration) =>
        showToast({ type: 'error', title, message, duration }),
    }),
    [dismissToast, showToast],
  );

  return (
    <AppToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed left-1/2 top-[calc(var(--s2b-safe-area-top,env(safe-area-inset-top,0px))+0.75rem)] z-[300] flex w-[calc(100%-1.5rem)] max-w-[430px] -translate-x-1/2 flex-col gap-2.5 sm:left-auto sm:right-5 sm:w-[400px] sm:translate-x-0"
        aria-live="polite"
        aria-relevant="additions removals"
      >
        {toasts.map((toast) => {
          const theme = toastTheme[toast.type];
          const Icon = theme.icon;

          return (
            <div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto overflow-hidden rounded-2xl border px-4 py-3.5 shadow-xl shadow-slate-900/10 backdrop-blur animate-[fadeIn_0.2s_ease-out] ${theme.card}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center ${theme.iconWrap}`}
                  aria-hidden="true"
                >
                  <Icon size={21} strokeWidth={2.25} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold leading-5">
                    {toast.title}
                  </p>
                  {toast.message && (
                    <p className="mt-0.5 text-xs font-medium leading-5 opacity-80">
                      {toast.message}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full opacity-65 transition hover:bg-black/5 hover:opacity-100 active:scale-95"
                  aria-label={`Dismiss ${theme.label.toLowerCase()} notification`}
                >
                  <X size={17} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AppToastContext.Provider>
  );
}

export function useAppToast() {
  const context = useContext(AppToastContext);

  if (!context) {
    throw new Error('useAppToast must be used inside AppToastProvider.');
  }

  return context;
}
