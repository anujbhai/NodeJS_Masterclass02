/*
 * Helpers for various tasks
 * */

// Dependencies
const crypto = require('crypto')
const querystring = require('querystring')
const https = require('https')
const config = require('./config')

// Container for all the helpers
const helpers = {}

// Create a SHA256 hash
helpers.hash = (str) => {
  if (typeof str === 'string' && str.length > 0) {
    const hash = crypto
      .createHmac('sha256', config.hashingSecret)
      .update(str)
      .digest('hex')
    return hash
    // eslint-disable-next-line
  } else {
    return false
  }
}

// Parse a JSON string to an object in all cases, without throwing
helpers.parseJsonToObject = (str) => {
  try {
    const obj = JSON.parse(str)
    return obj
  } catch (e) {
    return {}
  }
}

// Create a string of random alphanumeric characters, of a given length
helpers.createRandomString = (strLength) => {
  let requiredStrLen = strLength
  requiredStrLen =
    typeof requiredStrLen === 'number' && requiredStrLen > 0
      ? requiredStrLen
      : false

  if (!requiredStrLen) {
    return false
  }

  // Define all the possible characters that could go into a string
  const possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789'

  // Start the final string
  let str = ''

  for (let i = 1; i <= requiredStrLen; i++) {
    // Get a random character from the possibleCharacters string
    const randomCharacter = possibleCharacters.charAt(
      Math.floor(Math.random() * possibleCharacters.length)
    )

    // Append this character to the string
    str += randomCharacter
  }

  return str
}

// Send an SMS message via Twillio
helpers.sendTwilioSms = (phone, msg, callback) => {
  // Validate params
  let phoneParam = phone
  let msgParam = msg

  phoneParam =
    typeof phoneParam === 'string' && phoneParam.trim().length === 10
      ? phoneParam.trim()
      : false
  msgParam =
    typeof msgParam === 'string' &&
      msgParam.trim().length > 0 &&
      msgParam.trim().length <= 1600
      ? msgParam.trim()
      : false

  if (phoneParam && msgParam) {
    // Configure the request payload
    const payload = {
      From: config.twilio.fromPhone,
      To: `+91${phoneParam}`,
      Body: msgParam,
    }

    // Stringify the payload
    const stringPayload = querystring.stringify(payload)

    // Configure the request details
    const requestDetails = {
      protocol: 'https:',
      hostname: 'api.twilio.com',
      method: 'POST',
      path: `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
      auth: `${config.twilio.accountSid}:${config.twilio.authToken}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload),
      },
    }

    console.log('Request Details: ', requestDetails)

    // Instantiate the request object
    const req = https.request(requestDetails, (res) => {
      // Grab the status of the sent request
      const status = res.statusCode

      // Callback successfully if the request went through
      if (status === 200 || status === 201) {
        callback(false)
      } else {
        callback(`Status code returned was ${status}`)
      }
    })

    // Bind to the error event so it doesn't get thrown
    req.on('error', (e) => {
      callback(e)
    })

    // Add the payload
    req.write(stringPayload)

    // End the request
    req.end()
  } else {
    callback('Given parameters were either missing or invalid.')
  }
}

module.exports = helpers
