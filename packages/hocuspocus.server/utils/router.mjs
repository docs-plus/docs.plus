import path from 'path'
import express from 'express'
import dotenvFlow from 'dotenv-flow'

dotenvFlow.config({
  purge_dotenv: true,
  node_env: process.env.NODE_ENV,
  silent: true
})

const createRoute = (method, responseHandler, expressRouter) => {
  return (routePath, ...callbacks) => {
    const lastCallback = callbacks.pop()
    expressRouter[method](routePath, ...callbacks, (req, res) => {
      const result = lastCallback(req, res)
      // most of the time result is a promise, but we also support literal values in response handlers.
      if (!res.headersSent) {
        responseHandler(req, res, result)
      } else {
        console.warn(
          'WARNING FOR DEVELOPER: use express router directly if you want to handle response yourself.'
        )
      }
    })
  }
}

const APIHandler = async (req, res, result) => {
  try {
    // whether result is a promise or a literal value, await will get the literal value.
    const Result = await result
    res.send({ Success: true, data: Result })
  } catch (error) {
    console.error(error)
    // if (isProd) {
    //   console.apm(error)
    //   const {code} = error||{};
    //   error = {code: code||"UNHANDLED"};
    // }
    res.status(400).send({ Success: false, Error: error })
  }
}

const fileHandler = async (req, res, result) => {
  try {
    // whether result is a promise or a literal value, await will get the literal value.
    const filePath = await result
    if (typeof filePath === 'string' && filePath.includes('/')) {
      // if (process.env.NODE_ENV) {
      // res.set('X-Accel-Redirect', path.join('/uploads', filePath)).send()
      // } else {
      res.sendFile(filePath, { root: path.join(process.env.UPLOAD_ROOT) }, (err) => {
        if (err) {
          res.status(404).send(err)
        }
      })
      // }
    } else {
      res.status(404).send()
    }
  } catch (ex) {
    res.status(404).send()
  }
}

export default () => {
  const expressRouter = express.Router()

  return {
    get: createRoute('get', APIHandler, expressRouter),
    post: createRoute('post', APIHandler, expressRouter),
    patch: createRoute('patch', APIHandler, expressRouter),
    put: createRoute('put', APIHandler, expressRouter),
    delete: createRoute('delete', APIHandler, expressRouter),
    file: createRoute('get', fileHandler, expressRouter),
    expressRouter
  }
}
