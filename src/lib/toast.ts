type ToastListener = (message: string) => void;

let listener: ToastListener | null = null;

/** Show a short, non-blocking confirmation. */
export function toast(message: string) {
  listener?.(message);
}

export function subscribeToast(next: ToastListener) {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}
