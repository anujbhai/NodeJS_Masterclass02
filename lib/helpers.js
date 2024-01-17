/*
 * Helpers for various tasks
 * */

// Dependencies
const crypto = require('crypto')
const querystring = require('querystring')
const https = require('https')
const path = require('path')
const fs = require('fs')
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
      msgParam.trim().length > 0 && // eslint-disable-line
      msgParam.trim().length <= 1600 // eslint-disable-line
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

// Get the string content of a template
helpers.getTemplate = (templateName, data, callback) => {
  let tmpltName = templateName
  let dataParam = data

  dataParam =
    typeof dataParam === 'object' && dataParam !== null ? dataParam : {}

  tmpltName =
    typeof tmpltName === 'string' && tmpltName.length > 0 ? tmpltName : false

  if (tmpltName) {
    const templatesDir = path.join(__dirname, '/../templates/')

    fs.readFile(`${templatesDir}${tmpltName}.html`, 'utf8', (err, str) => {
      if (!err && str && str.length) {
        // Interpolate the string
        const finalString = helpers.interpolate(str, dataParam)
        callback(false, finalString)
      } else {
        callback('No template found')
      }
    })
  } else {
    callback('A valid html template was not specified.')
  }
}

// Add the universal header and footer to a string, and pass provided data object to the provided data object to the header and footer for interpolation
helpers.addUniversalTemplates = (str, data, callback) => {
  let strParam = str
  let dataParam = data

  strParam = typeof strParam === 'string' && strParam.length > 0 ? strParam : ''
  dataParam =
    typeof dataParam === 'object' && dataParam !== null ? dataParam : {}

  // Get the header
  helpers.getTemplate('_header', dataParam, (err, headerString) => {
    if (!err && headerString) {
      // Get the footer
      helpers.getTemplate('__footer', dataParam, (getTempErr, footerString) => {
        if (!getTempErr && footerString) {
          // Add the all together
          const fullString = headerString + strParam + footerString
          callback(false, fullString)
        } else {
          callback('Could not find the footer template')
        }
      })
    } else {
      callback('Could not find the header template')
    }
  })
}

// Take a given string and a data object and find/replace all the keys within it
helpers.interpolate = (str, data) => {
  let strParam = str
  let dataParam = data

  strParam = typeof strParam === 'string' && strParam.length > 0 ? strParam : ''
  dataParam =
    typeof dataParam === 'object' && dataParam !== null ? dataParam : {}

  // Add the templateGlobals to the data obj, prepending their key name with 'global'
  Object.keys(config.templateGlobals).forEach((keyName) => {
    if (Object.prototype.hasOwnProperty.call(config.templateGlobals, keyName)) {
      dataParam[`global.${keyName}`] = config.templateGlobals[keyName]
    }
  })

  // For each key in the data object, insert its value into the string at the corresponding
  Object.keys(dataParam).forEach((key) => {
    if (
      Object.prototype.hasOwnProperty.call(dataParam, key) &&
      typeof dataParam[key] === 'string'
    ) {
      const replace = dataParam[key]
      const find = `{${key}}`

      strParam = strParam.replace(find, replace)
    }
  })

  return strParam
}

module.exports = helpers
