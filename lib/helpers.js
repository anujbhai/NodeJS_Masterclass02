/*
 * Helpers for various tasks
 * */

// Dependencies
const crypto = require('crypto')
const config = require('./config')

// Container for all the helpers
const helpers = {}

// Create a SHA256 hash
helpers.hash = function (str) {
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
helpers.parseJsonToObject = function (str) {
  try {
    const obj = JSON.parse(str)
    return obj
  } catch (e) {
    return {}
  }
}

// Create a string of random alphanumeric characters, of a given length
helpers.createRandomString = function (strLength) {
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

module.exports = helpers
