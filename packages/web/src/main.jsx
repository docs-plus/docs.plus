import React, { lazy, Suspense, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  Route,
  useNavigate,
  redirect,
  Navigate,
  Outlet,
  BrowserRouter
} from 'react-router-dom'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './assets/global.scss'
import ReloadPrompt from './components/ReloadPrompt'
import { AuthProvider, useAuth } from './contexts/Auth'

import { supabase } from './supabase'

const Pads = lazy(() => import('./routes/Pads'))
const ErrorPage = lazy(() => import('./routes/ErrorPage'))
const PageNotFound = lazy(() => import('./routes/PageNotFound'))
const IntroPage = lazy(() => import('./routes/IntroPage'))
const AuthPage = lazy(() => import('./routes/auth/Auth'))
const SignupPage = lazy(() => import('./routes/auth/Signup'))
const LoginPage = lazy(() => import('./routes/auth/Login'))
const CheckYourEmailPage = lazy(() => import('./routes/auth/CheckYourEmail'))
const DashboardPage = lazy(() => import('./routes/Dashboard'))
const DashboardProfile = lazy(() => import('./routes/dashboard/Profile'))
const DashboardHomePage = lazy(() => import('./routes/dashboard/Home'))
const AskForUsernamePage = lazy(() => import('./routes/auth/AskForUsername'))

const RequireAuth = ({ children, value, redirectPath = '/auth/login' }) => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!profile?.doc_namespace || profile?.doc_namespace.length <= 0) {
      navigate('/auth/username_needed')
    } else if (!user) {
      navigate(redirectPath)
    } else if (user && user?.id && user?.email) {
      // navigate("/")
    }
  }, [user])

  return children || <Outlet />
}

// https://blog.netcetera.com/how-to-create-guarded-routes-for-your-react-app-d2fe7c7b6122

const router = createBrowserRouter([
  {
    path: '/',
    element: < IntroPage />,
    errorElement: <ErrorPage />
  },
  {
    path: '/auth',
    element: < AuthPage />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: 'signup',
        element: < SignupPage />,
        errorElement: <ErrorPage />
      },
      {
        path: 'login',
        element: < LoginPage />,
        errorElement: <ErrorPage />
      },
      {
        path: 'checkemail',
        element: < CheckYourEmailPage />,
        errorElement: <ErrorPage />
      },
      {
        path: 'username_needed',
        element: < AskForUsernamePage />,
        errorElement: <ErrorPage />
      }
    ]
  },
  {
    path: '/dashboard',
    element:
      <RequireAuth>
        < DashboardPage />
      </RequireAuth>,
    errorElement: <ErrorPage />,
    children: [
      {
        path: 'profile',
        element: < DashboardProfile />,
        errorElement: <ErrorPage />
      },
      {
        path: '',
        element: < DashboardHomePage />,
        errorElement: <ErrorPage />
      }
    ]
  },
  {
    path: '/g/:padName',
    element: <Pads />,
    errorElement: <ErrorPage />,
    loader: async ({ request, params }) => {
      return params.padName
    }
  },
  {
    path: '/:namespace/:padName',
    element: <Pads />,
    errorElement: <ErrorPage />,
    loader: async ({ request, params }) => {
      return params.padName
    }
  },
  {
    path: '*',
    element: <PageNotFound />
  }
])

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback="loading...">
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </Suspense>
    <ReloadPrompt />
  </React.StrictMode>
)
