/*
 * Request handlers
 * */

// Dependencies
const _data = require('./data')
const helpers = require('./helpers')

// Define the handlers
const handlers = {}

handlers.users = function (data, callback) {
  const acceptableMethods = ['post', 'get', 'put', 'delete']

  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback)
  } else {
    callback(405)
  }
}

// Container for the users submethods
handlers._users = {}

// Users - post
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = function (data, callback) {
  // Check that all required fields are filled out
  const firstName =
    typeof data.payload.firstName === 'string' &&
    data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false
  const lastName =
    typeof data.payload.lastName === 'string' &&
    data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false
  const phone =
    typeof data.payload.phone === 'string' &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false
  const password =
    typeof data.payload.password === 'string' &&
    data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false
  const tosAgreement =
    typeof data.payload.tosAgreement === 'boolean' &&
    data.payload.tosAgreement === true
      ? data.payload.tosAgreement
      : !data.payload.tosAgreement

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure the user doesnt already exist
    _data.read('users', phone, (err, phoneData) => {
      if (!err) {
        callback(400, { Error: 'A user with that phone number already exists' })
      }

      // Hash the password
      const hashedPassword = helpers.hash(password)

      // Create the user object
      if (!hashedPassword) {
        callback(500, { Error: "Could not hash the user's password" })
      }

      const userObject = {
        firstName,
        lastName,
        phone,
        hashedPassword,
        tosAgreement: true,
      }

      // Store the user
      _data.create('users', phone, userObject, (createUserErr) => {
        if (createUserErr) {
          console.error(createUserErr)
          callback(500, { Error: 'Could not create the new user' })
        }
        callback(200)
      })
    })

    // Read the file
    // Create a new file
    // Write to the file
    // Close the file
  } else {
    callback(400, { Error: 'Missing required fields' })
  }
}

// Users - get
handlers._users.get = function (data, callback) {}

// Users - put
handlers._users.put = function (data, callback) {}

// Users - delete
handlers._users.delete = function (data, callback) {}

handlers.ping = function (data, callback) {
  // Callback a http status code, and a payload object
  callback(200, { name: 'ping' })
}
handlers.notFound = function (data, callback) {
  callback(404)
}

module.exports = handlers
