import { Navigate, Route, Routes } from 'react-router';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import CreateRoom from './pages/CreateRoom';
import Dashboard from './pages/Dashboard';
import JoinRoom from './pages/JoinRoom';
import Login from './pages/Login';
import Register from './pages/Register';
import WatchRoom from './pages/WatchRoom';

function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/rooms/new" element={<CreateRoom />} />
          <Route path="/rooms/join" element={<JoinRoom />} />
          <Route path="/join/:roomCode" element={<JoinRoom />} />
          <Route path="/rooms/:roomId" element={<WatchRoom />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;