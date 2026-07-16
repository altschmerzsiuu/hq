import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';

const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const SensorData = lazy(() => import('@/pages/SensorData'));
const EstrusPrediction = lazy(() => import('@/pages/EstrusPrediction'));
const Recommendations = lazy(() => import('@/pages/Recommendations'));

const Notifications = lazy(() => import('@/pages/Notifications'));
const Settings = lazy(() => import('@/pages/Settings'));
const ManajemenTernak = lazy(() => import('@/pages/ManajemenTernak'));
const Reproduction = lazy(() => import('@/pages/Reproduction'));
const ActivityTimeline = lazy(() => import('@/pages/ActivityTimeline'));
const GendhisEye = lazy(() => import('@/pages/GendhisEye'));
const IotManager = lazy(() => import('@/pages/IotManager'));
const ComingSoon = lazy(() => import('@/pages/ComingSoon'));
const ResearchLab = lazy(() => import('@/pages/ResearchLab'));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Loading spinner component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Wrapper to simplify suspense usage
const withSuspense = (Component) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: withSuspense(Login),
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
        element: withSuspense(Dashboard),
      },
      {
        path: 'sensor-data',
        element: withSuspense(SensorData),
      },
      {
        path: 'estrus-prediction',
        element: withSuspense(EstrusPrediction),
      },
      {
        path: 'recommendations',
        element: withSuspense(Recommendations),
      },

      {
        path: 'notifications',
        element: withSuspense(Notifications),
      },
      {
        path: 'settings',
        element: withSuspense(Settings),
      },
      {
        path: 'ternak',
        element: withSuspense(ManajemenTernak),
      },
      {
        path: 'reproduction',
        element: withSuspense(Reproduction),
      },
      {
        path: 'kandang',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'pakan',
        element: withSuspense(ComingSoon),
      },
      {
        path: 'activity-timeline',
        element: withSuspense(ActivityTimeline),
      },
      {
        path: 'gendhis-eye',
        element: withSuspense(GendhisEye),
      },
      {
        path: 'iot-manager',
        element: withSuspense(IotManager),
      },
      {
        path: 'research-lab',
        element: withSuspense(ResearchLab),
      },
    ],
  },
  {
    path: '*',
    element: withSuspense(NotFound),
  },
]);
