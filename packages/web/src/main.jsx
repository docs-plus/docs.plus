import React, { lazy } from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  Route,
} from "react-router-dom";

import './assets/global.css'

const Pads = lazy(() => import('./routes/Pads'))
const ErrorPage = lazy(() => import('./routes/ErrorPage'))
const PageNotFound = lazy(() => import('./routes/PageNotFound'))
const IntroPage = lazy(() => import('./routes/IntroPage'))

const router = createBrowserRouter([
  {
    path: "/",
    element: < IntroPage />,
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
    <RouterProvider router={router} />
  </React.StrictMode>
)

