import { useEffect, useRef } from 'react';

// A modal dialog built on the browser's own <dialog> element. The browser draws the dark backdrop,
// keeps the keyboard focus inside the dialog, and makes the page behind it unclickable.
function ConfirmDialog({ options, onResult }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector('[data-initial-focus]')?.focus();
    }
  }, []);

  function handleCancelEvent(event) {
    // The Escape key. We stop the browser closing the dialog itself, so our own state stays in charge.
    event.preventDefault();
    onResult(false);
  }

  const isDanger = Boolean(options.danger);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      onCancel={handleCancelEvent}
      aria-labelledby="confirm-dialog-title"
    >
      <h2 id="confirm-dialog-title">{options.title}</h2>
      <p className="muted">{options.message}</p>

      <div className="confirm-actions">
        {/* For dangerous actions the safe button gets the focus, so a stray Enter cannot delete anything */}
        <button
          className="button button-secondary"
          type="button"
          onClick={() => onResult(false)}
          data-initial-focus={isDanger ? '' : undefined}
        >
          {options.cancelLabel ?? 'Cancel'}
        </button>

        <button
          className={isDanger ? 'button button-danger' : 'button'}
          type="button"
          onClick={() => onResult(true)}
          data-initial-focus={isDanger ? undefined : ''}
        >
          {options.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </dialog>
  );
}

export default ConfirmDialog;