import express from 'express'
import bodyParser from 'body-parser'
import morgan from 'morgan'
import helmet from 'helmet'
import chalk from 'chalk'
import cors from 'cors'

const createMiddleware = () => {
  const app = express()

  app.use(morgan(`${chalk.green('[morgan]')} :method :url :status - :response-time ms`))
  app.use(helmet())

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((domain) => domain.trim())
  const corsOptions = {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(new URL(origin).hostname)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  }
  app.use(cors(corsOptions))

  app.use((req, res, next) => {
    const queryString = new URL(`http://www.example.com${req.url}`)
    req.queryString = queryString.search.substring(1, queryString.search.length)
    next()
  })

  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(bodyParser.json())

  return app
}

export default createMiddleware
