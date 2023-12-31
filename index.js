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
const config = require('./lib/config')
const handlers = require('./lib/handlers')
const helpers = require('./lib/helpers')
const _data = require('./lib/data')

// function createFile() {
//   const result = _data.create('test', 'newFile1', { fizz: 'buzz' }, (err) => {
//     console.log('err', err)
//   })
//
//   console.log('result', result)
// }
// createFile()

// instantiate the HTTP server
const httpServer = http.createServer(async (req, res) => {
  await unifiedServer(req, res)
})

// instantiate the HTTPS server
const options = {
  key: fs.readFileSync('./https/key.pem'),
  cert: fs.readFileSync('./https/cert.pem'),
}
const httpsServer = https.createServer(options, async (req, res) => {
  await unifiedServer(req, res)
})

// Start the server
httpServer.listen(config.httpPort, () => {
  console.log(`The server is listening on port ${config.httpPort}`)
})

// start the HTTPS server
httpsServer.listen(config.httpsPort, () => {
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
          typeof router[trimmedPath] !== 'undefined'
            ? router[trimmedPath]
            : handlers.notFound

        const data = {
          trimmedPath,
          queryStringObject,
          method,
          headers,
          payload: helpers.parseJsonToObject(buffer),
        }

        // --- Route the request to the handler specified in the router ---
        chosenHandler(data, (statusCode, payload) => {
          let stat = statusCode
          let pl = payload
          // --- Use the status code called back by the handler, or default to 200 ---
          stat = typeof stat === 'number' ? stat : 200 // eslint-disable-line

          // --- Use the payload called back by the handler, or default to an empty object ---
          pl = typeof pl === 'object' ? pl : {} // eslint-disable-line

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
      req.on('error', (err) => {
        reject(err)
      })
    })
  } catch (err) {
    console.error('Error processing request', err)
    res.statusCode = 500
    res.end('Internal server error')
  }
}

// Define a request router
const router = {
  ping: handlers.ping,
  users: handlers.users,
  tokens: handlers.tokens,
  checks: handlers.checks,
}
