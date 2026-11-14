const STATUS_LABELS = {
  connecting: 'Connecting...',
  connected: 'Live',
  reconnecting: 'Connection lost. Reconnecting...',
  disconnected: 'Disconnected',
};

function ConnectionStatus({ status, onReconnect }) {
  return (
    <div className={`connection-status connection-${status}`}>
      <span className="status-dot" />
      <span>{STATUS_LABELS[status]}</span>

      {status === 'disconnected' && (
        <button className="button button-secondary button-small" type="button" onClick={onReconnect}>
          Reconnect
        </button>
      )}
    </div>
  );
}

export default ConnectionStatus;