import { useEffect, useRef, useState } from "react";

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  tone: "success" | "error" | "neutral";
}

interface PushToastInput {
  title: string;
  message: string;
  tone?: ToastItem["tone"];
  durationMs?: number;
}

export function useToastCenter() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timerRef = useRef(new Map<string, number>());

  const dismissToast = (toastId: string) => {
    const timerId = timerRef.current.get(toastId);

    if (timerId) {
      window.clearTimeout(timerId);
      timerRef.current.delete(toastId);
    }

    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const pushToast = ({ title, message, tone = "neutral", durationMs = 6000 }: PushToastInput) => {
    const toastId = crypto.randomUUID();
    setToasts((current) => [{ id: toastId, title, message, tone }, ...current].slice(0, 4));

    const timerId = window.setTimeout(() => {
      dismissToast(toastId);
    }, durationMs);

    timerRef.current.set(toastId, timerId);
  };

  useEffect(() => {
    return () => {
      for (const timerId of timerRef.current.values()) {
        window.clearTimeout(timerId);
      }

      timerRef.current.clear();
    };
  }, []);

  return {
    toasts,
    pushToast,
    dismissToast
  };
}
