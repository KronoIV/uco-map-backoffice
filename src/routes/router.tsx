import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import DashboardPage from '../pages/DashboardPage';
import MapPage from '../pages/MapPage';
import NodesPage from '../pages/NodesPage';
import SettingsPage from '../pages/SettingsPage';
import DeviceSessionsPage from '../pages/device-sessions/DeviceSessionsPage';
import CampusPage from '../pages/CampusPage';
import UsersPage from '../pages/users/UsersPage';
import NotFoundPage from '../pages/NotFoundPage';

const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },

  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'map', element: <MapPage /> },
          { path: 'nodes', element: <NodesPage /> },
          { path: 'campus', element: <CampusPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'sessions', element: <DeviceSessionsPage /> },
          { path: 'users', element: <UsersPage /> },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);

export default router;

