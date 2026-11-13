import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import ErrorList from '../components/ErrorList';
import { createRoom } from '../services/roomService';

function CreateRoom() {
  const navigate = useNavigate();

  const [roomName, setRoomName] = useState('');
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      const room = await createRoom(roomName);
      navigate(`/rooms/${room.id}`);
    } catch (error) {
      setErrors(error.errors ?? ['Something went wrong. Please try again.']);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card form-card">
      <h2>Create a room</h2>
      <p className="muted">You will be the host. Share the room code or invitation link with friends.</p>

      <form className="form" onSubmit={handleSubmit}>
        <ErrorList errors={errors} />

        <div className="field">
          <label htmlFor="roomName">Room name</label>
          <input
            id="roomName"
            type="text"
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            maxLength={50}
            placeholder="Friday movie night"
            required
          />
        </div>

        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create room'}
        </button>
      </form>

      <p className="form-footer">
        <Link to="/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}

export default CreateRoom;