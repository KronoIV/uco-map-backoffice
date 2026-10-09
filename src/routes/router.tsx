import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import DashboardPage from '../pages/DashboardPage';
import MapPage from '../pages/MapPage';
import SettingsPage from '../pages/SettingsPage';
import ActivityPage from '../pages/ActivityPage';
import CampusPage from '../pages/CampusPage';
import EventsPage from '../pages/EventsPage';
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
          // Los puntos y caminos se administran en el mapa
          { path: 'nodes', element: <Navigate to="/map" replace /> },
          { path: 'campus', element: <CampusPage /> },
          { path: 'events', element: <EventsPage /> },
          { path: 'ar-points', element: <Navigate to="/map?tab=ar" replace /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'sessions', element: <ActivityPage /> },
          { path: 'trips', element: <Navigate to="/sessions?tab=trips" replace /> },
          { path: 'users', element: <UsersPage /> },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);

export default router;

