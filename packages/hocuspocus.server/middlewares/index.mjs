import express from 'express'
import morgan from 'morgan'
import helmet from 'helmet'
import chalk from 'chalk'
import cors from 'cors'
import fileUpload from 'express-fileupload'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

const FOUR_MEG = 4 * 1024 * 1024
const MAX_UPLOAD_SIZE = FOUR_MEG //  maxFileSize
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || 100

const createMiddleware = () => {
  const app = express()

  // General API rate limiter
  const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count successful requests against limit
    keyGenerator: (req) => {
      // Use IPv6-aware key generator helper + user agent for better request identification
      const ipKey = ipKeyGenerator(req)
      const userAgent = req.headers['user-agent'] || 'unknown'
      return `${ipKey}-${userAgent}`
    }
  })

  // Apply general rate limiting to all routes
  app.use(apiLimiter)

  // Add security headers early in middleware chain
  app.use(
    helmet({
      contentSecurityPolicy: true,
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: true,
      dnsPrefetchControl: true,
      frameguard: true,
      hidePoweredBy: true,
      hsts: true,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: true,
      referrerPolicy: true,
      xssFilter: true
    })
  )

  app.use(morgan(`${chalk.green('[morgan]')} :method :url :status - :response-time ms`))

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

  app.use(express.urlencoded({ extended: true, limit: '20kb' }))
  app.use(express.json({ limit: '20kb' }))

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
