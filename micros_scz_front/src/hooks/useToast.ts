import { useCallback, useEffect, useRef, useState } from 'react';

interface Toast {
  id: number;
  message: string;
}

export function useToast(durationMs = 4000) {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextIdRef = useRef(0);

  const showToast = useCallback((message: string) => {
    nextIdRef.current += 1;
    setToast({ id: nextIdRef.current, message });
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timerId = window.setTimeout(() => setToast(null), durationMs);
    return () => window.clearTimeout(timerId);
  }, [durationMs, toast]);

  return { toastMessage: toast?.message ?? null, showToast };
}
