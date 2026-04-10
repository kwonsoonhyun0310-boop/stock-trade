import type { ToastItem } from "../hooks/use-toast-center.js";

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (toastId: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast-card toast-${toast.tone}`}>
          <div className="toast-content">
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" className="toast-dismiss" onClick={() => onDismiss(toast.id)}>
            닫기
          </button>
        </article>
      ))}
    </div>
  );
}
