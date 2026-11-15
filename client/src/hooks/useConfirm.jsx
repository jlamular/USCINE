import { useCallback, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

// const { confirm, confirmDialog } = useConfirm();
// const ok = await confirm({ title, message, confirmLabel, danger });
// ...and render {confirmDialog} somewhere in the component's markup.
export function useConfirm() {
  const [options, setOptions] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((dialogOptions) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOptions(dialogOptions);
    });
  }, []);

  const handleResult = useCallback((confirmed) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const confirmDialog = options ? <ConfirmDialog options={options} onResult={handleResult} /> : null;

  return { confirm, confirmDialog };
}