import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ErrorList from '../components/ErrorList';
import { joinRoom } from '../services/roomService';

function JoinRoom() {
  // When opened from an invitation link (/join/ABCD2345), the code comes from the URL
  const { roomCode: codeFromLink } = useParams();
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState(codeFromLink ?? '');
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      const room = await joinRoom(roomCode);
      navigate(`/rooms/${room.id}`);
    } catch (error) {
      setErrors(error.errors ?? ['Something went wrong. Please try again.']);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card form-card">
      <h2>Join a room</h2>
      <p className="muted">Enter the room code you received.</p>

      <form className="form" onSubmit={handleSubmit}>
        <ErrorList errors={errors} />

        <div className="field">
          <label htmlFor="roomCode">Room code</label>
          <input
            id="roomCode"
            className="code-input"
            type="text"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value)}
            maxLength={20}
            autoComplete="off"
            placeholder="ABCD-2345"
            required
          />
        </div>

        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Joining...' : 'Join room'}
        </button>
      </form>

      <p className="form-footer">
        <Link to="/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}

export default JoinRoom;