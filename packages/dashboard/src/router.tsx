import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './components/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
        ],
      },
      {
        element: <DashboardLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
        ],
      },
      { path: '/', element: <Navigate to="/dashboard" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
