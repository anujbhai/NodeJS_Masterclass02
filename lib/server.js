/*
 * Server related tasks
 * */

// Dependencies
const http = require('http')
const https = require('https')
const { URL } = require('url')
const { StringDecoder } = require('string_decoder')
const fs = require('fs')
const path = require('path')
const util = require('util')

// resources
const { searchParamsToObj } = require('../utils')
const config = require('./config')
const handlers = require('./handlers')
const helpers = require('./helpers')

const debug = util.debuglog('server')
// const _data = require('./lib/data')

// @TODO remove test run
// helpers.sendTwilioSms('8860081139', 'Hello from NMC', (err) => {
//   debug('error: ', err)
// })

// function createFile() {
//   const result = _data.create('test', 'newFile1', { fizz: 'buzz' }, (err) => {
//     debug('err', err)
//   })
//
//   debug('result', result)
// }
// createFile()

// Instantiate the server module object
const server = {}

// instantiate the HTTP server
server.httpServer = http.createServer(async (req, res) => {
  await server.unifiedServer(req, res)
})

// instantiate the HTTPS server
server.options = {
  key: fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '/../https/cert.pem')),
}
server.httpsServer = https.createServer(server.options, async (req, res) => {
  await server.unifiedServer(req, res)
})

// All the server logic for both the http and https server
server.unifiedServer = async (req, res) => {
  try {
    // --- Get the URL and parse it ---
    const parsedUrl = new URL(req.url, 'http://localhost:3000/')

    // --- Get the path ---
    const parsedUrlPath = parsedUrl.pathname
    const trimmedPath = parsedUrlPath.replace(/^\/+|\/+$/g, '')

    // --- Get query string as an object ---
    const queryStringObject = searchParamsToObj(parsedUrl.searchParams)

    // --- Get HTTP method ---
    const method = req.method.toLowerCase()

    // --- Get request headers as an object ---
    const { headers } = req

    // --- Get the payload if any ---
    const decoder = new StringDecoder('utf-8')
    let buffer = ''

    await new Promise((resolve, reject) => {
      req.on('data', (data) => {
        buffer += decoder.write(data)
      })
      req.on('end', () => {
        buffer += decoder.end()

        // --- Choose the handler this request should go to. ---
        // ---If one is not found, use the notFound handler ---
        const chosenHandler =
          typeof server.router[trimmedPath] !== 'undefined'
            ? server.router[trimmedPath]
            : handlers.notFound

        const data = {
          trimmedPath,
          queryStringObject,
          method,
          headers,
          payload: helpers.parseJsonToObject(buffer),
        }

        // --- Route the request to the handler specified in the router ---
        chosenHandler(data, (statusCode, payload, contentType) => {
          let stat = statusCode
          let pl = payload
          let cntType = contentType

          // --- Determine the type of response (fallback to JSON) ---
          cntType = typeof cntType === 'string' ? cntType : 'json'
          // --- Use the status code called back by the handler, or default to 200 ---
          stat = typeof stat === 'number' ? stat : 200 // eslint-disable-line

          // --- Return the response parts that are content-specific ---
          let payloadString = ''

          if (cntType === 'json') {
            res.setHeader('Content-Type', 'application/json')

            // --- Use the payload called back by the handler, or default to an empty object ---
            pl = typeof pl === 'object' ? pl : {} // eslint-disable-line

            // --- Convert the payload to a string ---
            payloadString = JSON.stringify(pl)
          }

          if (cntType === 'html') {
            res.setHeader('Content-Type', 'text/html')

            payloadString = typeof pl === 'string' ? pl : ''
          }

          // --- Return the response parts that are common to all content-types ---
          res.writeHead(stat)
          res.end(payloadString)

          // --- Log the request path ... green for success, red for error ---
          if (stat === 200) {
            debug(
              '\x1b[32m%s\x1b[0m',
              `${method.toUpperCase()}/${trimmedPath} ${stat}`
            )
          } else {
            debug(
              '\x1b[31m%s\x1b[0m',
              `${method.toUpperCase()}/${trimmedPath} ${stat}`
            )
          }
        })
      })
      req.on('error', (err) => {
        reject(err)
      })
    })
  } catch (err) {
    debug('Error processing request', err)
    res.statusCode = 500
    res.end('Internal server error')
  }
}

// Define a request router
server.router = {
  '': handlers.index,
  'account/create': handlers.accountCreate,
  'account/edit': handlers.accountEdit,
  'account/deleted': handlers.accountDeleted,
  'session/create': handlers.sessionCreate,
  'session/deleted': handlers.sessionDeleted,
  'checks/all': handlers.checkList,
  'checks/create': handlers.checkCreate,
  'checks/edit': handlers.checkEdit,
  ping: handlers.ping,
  'api/users': handlers.users,
  'api/tokens': handlers.tokens,
  'api/checks': handlers.checks,
}

// Init script
server.init = () => {
  // Start the server
  server.httpServer.listen(config.httpPort, () => {
    console.log(
      '\x1b[35m%s\x1b[0m',
      `The server is listening on port ${config.httpPort}`
    )
  })

  // start the HTTPS server
  server.httpsServer.listen(config.httpsPort, () => {
    console.log(
      '\x1b[36m%s\x1b[0m',
      `The server is listening on port ${config.httpsPort}`
    )
  })
}

// Export the module
module.exports = server
