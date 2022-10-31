import React, { lazy } from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  Route,
} from "react-router-dom";

import './assets/global.scss'

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

// // On page load or when changing themes, best to add inline in `head` to avoid FOUC
// if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
//   document.documentElement.classList.add('dark')
// } else {
//   document.documentElement.classList.remove('dark')
// }

// // Whenever the user explicitly chooses light mode
// localStorage.theme = 'light'

// // Whenever the user explicitly chooses dark mode
// localStorage.theme = 'dark'

// // Whenever the user explicitly chooses to respect the OS preference
// localStorage.removeItem('theme')

