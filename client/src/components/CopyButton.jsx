import { useState } from 'react';

function CopyButton({ text, label = 'Copy' }) {
  const [status, setStatus] = useState('idle');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }

    setTimeout(() => setStatus('idle'), 2000);
  }

  let buttonText = label;
  if (status === 'copied') {
    buttonText = 'Copied!';
  } else if (status === 'failed') {
    buttonText = 'Copy failed';
  }

  return (
    <button className="button button-secondary button-small" type="button" onClick={handleCopy}>
      {buttonText}
    </button>
  );
}

export default CopyButton;