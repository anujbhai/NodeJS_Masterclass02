/*
 * Primary file for the API
 * */

// Dependencies
const http = require('http')
const https = require('https')
const { URL } = require('url')
const { StringDecoder } = require('string_decoder')
const fs = require('fs')

// resources
const { searchParamsToObj } = require('./utils')
const config = require('./config')

// instantiate the HTTP server
const httpServer = http.createServer(async function (req, res) {
  await unifiedServer(req, res)
})

// instantiate the HTTPS server
const options = {
  key: fs.readFileSync('./https/key.pem'),
  cert: fs.readFileSync('./https/cert.pem'),
}
const httpsServer = https.createServer(options, async function (req, res) {
  await unifiedServer(req, res)
})

// Start the server
httpServer.listen(config.httpPort, function () {
  console.log(`The server is listening on port ${config.httpPort}`)
})

// Instantiate the HTTPS server
httpsServer.listen(config.httpsPort, function () {
  console.log(`The server is listening on port ${config.httpsPort}`)
})

// All the server logic for both the http and https server
const unifiedServer = async function (req, res) {
  try {
    // --- Get the URL and parse it ---
    const parsedUrl = new URL(req.url, 'http://localhost:3000/')

    // --- Get the path ---
    const path = parsedUrl.pathname
    const trimmedPath = path.replace(/^\/+|\/+$/g, '')

    // --- Get query string as an object ---
    const queryStringObject = searchParamsToObj(parsedUrl.searchParams)

    // --- Get HTTP method ---
    const method = req.method.toLowerCase()

    // --- Get request headers as an object ---
    const headers = req.headers

    // --- Get the payload if any ---
    const decoder = new StringDecoder('utf-8')
    let buffer = ''

    await new Promise((resolve, reject) => {
      req.on('data', function (data) {
        buffer += decoder.write(data)
      })
      req.on('end', function () {
        buffer += decoder.end()

        // --- Choose the handler this request should go to. ---
        // ---If one is not found, use the notFound handler ---
        const chosenHandler =
          typeof router[trimmedPath] !== 'undefined'
            ? router[trimmedPath]
            : handlers.notFound

        const data = {
          trimmedPath,
          queryStringObject,
          method,
          headers,
          payload: buffer,
        }

        // --- Route the request to the handler specified in the router ---
        chosenHandler(data, function (statusCode, payload) {
          // --- Use the status code called back by the handler, or default to 200 ---
          statusCode = typeof statusCode === 'number' ? statusCode : 200

          // --- Use the payload called back by the handler, or default to an empty object ---
          payload = typeof payload === 'object' ? payload : {}

          // --- Convert the payload to a string ---
          const payloadString = JSON.stringify(payload)

          // --- Return the response ---
          res.setHeader('Content-Type', 'application/json')
          res.writeHead(statusCode)
          res.end(payloadString)

          // --- Log the request path ---
          console.log('Returning this response: ', statusCode, payloadString)
        })
      })
      req.on('error', function (err) {
        reject(err)
      })
    })
  } catch (err) {
    conssole.error('Error processing request', err)
    res.statusCode = 500
    res.end('Internal server error')
  }
}

// Define the handlers
const handlers = {}
handlers.ping = function (data, callback) {
  // Callback a http status code, and a payload object
  callback(200, { name: 'ping' })
}
handlers.notFound = function (data, callback) {
  callback(404)
}

// Define a request router
const router = {
  ping: handlers.ping,
}
