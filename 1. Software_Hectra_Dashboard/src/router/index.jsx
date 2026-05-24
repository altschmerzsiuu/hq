import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import SensorData from '@/pages/SensorData';
import EstrusPrediction from '@/pages/EstrusPrediction';
import Recommendations from '@/pages/Recommendations';
import BehaviorAnalytics from '@/pages/BehaviorAnalytics';
import Notifications from '@/pages/Notifications';
import Settings from '@/pages/Settings';
import ManajemenTernak from '@/pages/ManajemenTernak';
import Reproduction from '@/pages/Reproduction';
import ActivityTimeline from '@/pages/ActivityTimeline';
import GendhisEye from '@/pages/GendhisEye';
import IotManager from '@/pages/IotManager';
import ComingSoon from '@/pages/ComingSoon';
import ResearchLab from '@/pages/ResearchLab';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
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
        path: 'behavior-analytics',
        element: <BehaviorAnalytics />,
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
        path: 'reproduction',
        element: <Reproduction />,
      },
      {
        path: 'kandang',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'pakan',
        element: <ComingSoon />,
      },
      {
        path: 'activity-timeline',
        element: <ActivityTimeline />,
      },
      {
        path: 'gendhis-eye',
        element: <GendhisEye />,
      },
      {
        path: 'iot-manager',
        element: <IotManager />,
      },
      {
        path: 'research-lab',
        element: <ResearchLab />,
      },
    ],
  },
]);
