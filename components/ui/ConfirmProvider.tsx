'use client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
};

type CtxType = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const Ctx = createContext<CtxType | null>(null);

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}

export default function ConfirmProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<
    null | (ConfirmOptions & { id: string; resolve: (v: boolean) => void })
  >(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const id = crypto.randomUUID();
      setState({ id, resolve, ...opts });
    });
  }, []);

  const onClose = useCallback(
    (ok: boolean) => {
      if (!state) return;
      const { resolve } = state;
      setState(null);
      resolve(ok);
    },
    [state],
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {state && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => onClose(false)}
          />
          <div className="relative w-[90vw] max-w-md rounded-lg border bg-white p-4 shadow-lg dark:border-gray-800 dark:bg-gray-900">
            {state.title && (
              <div className="text-sm font-semibold">{state.title}</div>
            )}
            {state.description && (
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {state.description}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded border px-3 py-1.5 text-sm dark:border-gray-700"
                onClick={() => onClose(false)}
              >
                {state.cancelText ?? 'Cancel'}
              </button>
              <button
                className={
                  'rounded px-3 py-1.5 text-sm text-white ' +
                  (state.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700')
                }
                onClick={() => onClose(true)}
              >
                {state.confirmText ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
