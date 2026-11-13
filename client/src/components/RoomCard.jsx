import { Link } from 'react-router';
import { formatRoomCode } from '../utils/roomUtils';

function RoomCard({ room }) {
  const participantLabel = room.participantCount === 1 ? 'participant' : 'participants';

  return (
    <Link to={`/rooms/${room.id}`} className="room-card">
      <div className="room-card-top">
        <h3 className="room-card-name">{room.roomName}</h3>
        {room.isHost && <span className="badge">Host</span>}
      </div>

      <p className="muted small">Hosted by {room.hostDisplayName}</p>

      <div className="room-card-bottom">
        <span className="room-code">{formatRoomCode(room.roomCode)}</span>
        <span className="muted small">
          {room.participantCount} {participantLabel}
        </span>
      </div>
    </Link>
  );
}

export default RoomCard;