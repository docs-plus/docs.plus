import express from 'express'
import bodyParser from 'body-parser'
import morgan from 'morgan'
import helmet from 'helmet'
import chalk from 'chalk'
import cors from 'cors'
import fileUpload from 'express-fileupload'

const TWO_MEG = 2 * 1024 * 1024
const MAX_UPLOAD_SIZE = TWO_MEG //  maxFileSize

const createMiddleware = () => {
  const app = express()

  app.use(morgan(`${chalk.green('[morgan]')} :method :url :status - :response-time ms`))
  app.use(helmet())

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((domain) => domain.trim())

  const isDomainOrSubdomain = (origin) => {
    const hostname = new URL(origin).hostname
    return allowedOrigins.some((allowedOrigin) => {
      const regex = new RegExp(`^(.+\\.)*${allowedOrigin}$`, 'i')
      return regex.test(hostname)
    })
  }

  const corsOptions = {
    origin: function (origin, callback) {
      if (!origin || isDomainOrSubdomain(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  }

  // app.use(cors(corsOptions))
  app.use(cors())

  app.use((req, res, next) => {
    const queryString = new URL(`http://www.example.com${req.url}`)
    req.queryString = queryString.search.substring(1, queryString.search.length)
    next()
  })

  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(bodyParser.json())
  app.use(
    fileUpload({
      createParentPath: true,
      limits: { fileSize: process.env.DO_STORAGE_MAX_FILE_SIZE || MAX_UPLOAD_SIZE },
      tempFileDir: process.env.LOCAL_STORAGE_PATH || './temp',
      parseNested: true
    })
  )

  return app
}

export default createMiddleware
