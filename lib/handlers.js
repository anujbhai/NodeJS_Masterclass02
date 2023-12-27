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
handlers._users.post = async function (data, callback) {
  // Check that all required fields are filled out
  const firstName =
    // eslint-disable-next-line
    typeof data.payload.firstName === 'string' &&
    data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false
  const lastName =
    // eslint-disable-next-line
    typeof data.payload.lastName === 'string' &&
    data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false
  const phone =
    // eslint-disable-next-line
    typeof data.payload.phone === 'string' &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false
  const password =
    // eslint-disable-next-line
    typeof data.payload.password === 'string' &&
    data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false
  const tosAgreement =
    // eslint-disable-next-line
    typeof data.payload.tosAgreement === 'boolean' &&
    data.payload.tosAgreement === true
      ? true
      : false

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure the user doesnt already exist
    await _data.read('users', phone, async function (err, phonedata) {
      if (err) {
        // Hash the password
        const hashedPassword = helpers.hash(password)

        // Create the user object
        if (hashedPassword) {
          const userObject = {
            firstName: firstName, // eslint-disable-line
            lastName: lastName, // eslint-disable-line
            phone: phone, // eslint-disable-line
            hashedPassword: hashedPassword, // eslint-disable-line
            tosAgreement: true,
          }

          // Store the user
          await _data.create('users', phone, userObject, (createUserError) => {
            if (!createUserError) {
              callback(200)
            } else {
              console.log(createUserError)
              callback(500, { Error: 'Could not create the new user' })
            }
          })
        } else {
          callback(500, { Error: "Could not hash the user's password." })
        }
      } else {
        // User alread exists
        callback(400, { Error: 'A user with that phone number already exists' })
      }
    })
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
