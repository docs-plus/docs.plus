import React, { lazy, Suspense } from 'react'
import { useEffect } from 'react';
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
} from "react-router-dom";
import './assets/global.scss'
import ReloadPrompt from './components/ReloadPrompt'
import { AuthProvider, useAuth } from './contexts/Auth'


const Pads = lazy(() => import('./routes/Pads'))
const ErrorPage = lazy(() => import('./routes/ErrorPage'))
const PageNotFound = lazy(() => import('./routes/PageNotFound'))
const IntroPage = lazy(() => import('./routes/IntroPage'))
const SignupPage = lazy(() => import('./routes/Signup'))
const LoginPage = lazy(() => import('./routes/Login'))
const DashboardPage = lazy(() => import('./routes/Dashboard'))
const CheckYourEmailPage = lazy(() => import('./routes/CheckYourEmail'))


const RequireAuth = ({ children, value, redirectPath = "/auth/login" }) => {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    console.log("coming user", user)
    if (!user) {
      navigate(redirectPath)
    } else if (user && user?.id && user?.email) {
      navigate("/dashboard")
    }
  }, [user])

  return children ? children : <Outlet />;
}


// https://blog.netcetera.com/how-to-create-guarded-routes-for-your-react-app-d2fe7c7b6122


const router = createBrowserRouter([
  {
    path: "/",
    element: < IntroPage />,
    errorElement: <ErrorPage />
  },
  {
    path: "/auth/signup",
    index: true,
    element:
      <RequireAuth>
        < SignupPage />
      </RequireAuth>,
    errorElement: <ErrorPage />
  },
  {
    path: "/auth/login",
    element:
      <RequireAuth>
        < LoginPage />
      </RequireAuth>,
    errorElement: <ErrorPage />
  },
  {
    path: "/auth/checkEmail",
    element:
      <RequireAuth>
        < CheckYourEmailPage />
      </RequireAuth>,
    errorElement: <ErrorPage />
  },
  {
    path: "/dashboard",
    element:
      <RequireAuth>
        < DashboardPage />
      </RequireAuth>
    ,
    errorElement: <ErrorPage />
  },
  {
    path: "/:padName",
    element: <Pads />,
    errorElement: <ErrorPage />,
    loader: async ({ request, params }) => {
      return params.padName
    }
  },
  {
    path: "*",
    element: <PageNotFound />
  }
]);


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback="loading...">
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </Suspense>
    <ReloadPrompt />
  </React.StrictMode>
)
