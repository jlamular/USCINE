import { Navigate, Route, Routes } from 'react-router';
import PageTitle from './components/PageTitle';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import CreateRoom from './pages/CreateRoom';
import Dashboard from './pages/Dashboard';
import JoinRoom from './pages/JoinRoom';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Register from './pages/Register';
import WatchRoom from './pages/WatchRoom';

function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <PageTitle title="Log in">
              <Login />
            </PageTitle>
          }
        />
        <Route
          path="/register"
          element={
            <PageTitle title="Create account">
              <Register />
            </PageTitle>
          }
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={
              <PageTitle title="Dashboard">
                <Dashboard />
              </PageTitle>
            }
          />
          <Route
            path="/rooms/new"
            element={
              <PageTitle title="Create room">
                <CreateRoom />
              </PageTitle>
            }
          />
          <Route
            path="/rooms/join"
            element={
              <PageTitle title="Join room">
                <JoinRoom />
              </PageTitle>
            }
          />
          <Route
            path="/join/:roomCode"
            element={
              <PageTitle title="Join room">
                <JoinRoom />
              </PageTitle>
            }
          />
          <Route path="/rooms/:roomId" element={<WatchRoom />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="*"
        element={
          <PageTitle title="Page not found">
            <NotFound />
          </PageTitle>
        }
      />
    </Routes>
  );
}

export default App;