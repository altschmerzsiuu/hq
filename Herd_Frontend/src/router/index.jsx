import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import ErrorBoundary from '@/components/layout/ErrorBoundary';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import SensorData from '@/pages/SensorData';
import EstrusPrediction from '@/pages/EstrusPrediction';
import Recommendations from '@/pages/Recommendations';
import Notifications from '@/pages/Notifications';
import Settings from '@/pages/Settings';
import ManajemenTernak from '@/pages/ManajemenTernak';
import DetailTernak from '@/pages/DetailTernak';
import ResearchLab from '@/pages/ResearchLab';
import NotFound from '@/pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: '/',
    errorElement: <ErrorBoundary />,
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'sensor-data',
        element: <SensorData />,
      },
      {
        path: 'estrus-prediction',
        element: <EstrusPrediction />,
      },
      {
        path: 'recommendations',
        element: <Recommendations />,
      },
      {
        path: 'notifications',
        element: <Notifications />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'ternak',
        element: <ManajemenTernak />,
      },
      {
        path: 'ternak/:id',
        element: <DetailTernak />,
      },
      {
        path: 'kandang',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'research-lab',
        element: <ResearchLab />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);
