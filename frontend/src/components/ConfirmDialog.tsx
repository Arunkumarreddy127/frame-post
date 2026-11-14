import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (accepted: boolean) => void };
export type Confirm = (options: ConfirmOptions) => Promise<boolean>;

type ConfirmDialogProps = ConfirmOptions & {
  onAnswer: (accepted: boolean) => void;
};

function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onAnswer,
}: ConfirmDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelButton.current?.focus();
    return () => previous?.focus?.();
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onAnswer(false);
      return;
    }
    if (event.key !== "Tab") return;
    const first = cancelButton.current;
    const last = confirmButton.current;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return createPortal(
    <div
      className="confirm-layer"
      onMouseDown={() => onAnswer(false)}
      onKeyDown={onKeyDown}
    >
      <div
        className="panel confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-dialog-title">{title}</h3>
        <p id="confirm-dialog-message" className="status">
          {message}
        </p>
        <div className="confirm-dialog-actions">
          <button
            ref={cancelButton}
            type="button"
            className="secondary-button"
            onClick={() => onAnswer(false)}
          >
            Cancel
          </button>
          <button
            ref={confirmButton}
            type="button"
            className={danger ? "primary-button danger-solid" : "primary-button"}
            onClick={() => onAnswer(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Promise-based replacement for `window.confirm`; render `dialog` once in the component tree. */
export function useConfirm(): {
  confirm: Confirm;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const answer = useCallback(
    (accepted: boolean) => {
      pending?.resolve(accepted);
      setPending(null);
    },
    [pending],
  );

  const dialog = pending ? (
    <ConfirmDialog
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel}
      danger={pending.danger}
      onAnswer={answer}
    />
  ) : null;

  return { confirm, dialog };
}
