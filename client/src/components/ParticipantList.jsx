function ParticipantList({ participants, currentUserId }) {
  if (participants.length === 0) {
    return <p className="muted">No participants yet.</p>;
  }

  return (
    <ul className="participant-list">
      {participants.map((participant) => (
        <li key={participant.userId} className="participant">
          <span className="avatar">{participant.displayName.charAt(0).toUpperCase()}</span>

          <span className="participant-name">
            {participant.displayName}
            {participant.userId === currentUserId && <span className="muted"> (you)</span>}
          </span>

          {participant.isHost && <span className="badge">Host</span>}

          <span
            className={participant.isOnline ? 'status-dot dot-online' : 'status-dot'}
            title={participant.isOnline ? 'Online' : 'Offline'}
          />
        </li>
      ))}
    </ul>
  );
}

export default ParticipantList;