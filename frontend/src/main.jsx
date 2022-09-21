import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  Route,
} from "react-router-dom";

import Pads from './routes/pads'
import ErrorPage from "./error-page";

const router = createBrowserRouter([
  {
    path: "/:padName",
    element: <Pads />,
    errorElement: <ErrorPage />,
    loader: async ({ request, params }) => {
      return params.padName
    }
  },
]);

import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
