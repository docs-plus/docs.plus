import express from 'express'
import bodyParser from 'body-parser'
import morgan from 'morgan'
import helmet from 'helmet'
import chalk from 'chalk'
import cors from 'cors'

const app = express()

app.use(morgan(`${ chalk.green('[morgan]') } :method :url :status - :response-time ms`))
app.use(helmet())
app.use(cors())

app.use((req, res, next) => {
  const queryString = new URL(`http://www.example.com${ req.url }`)
  req.queryString = queryString.search.substring(1, queryString.search.length)
  next()
})

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

export default app
