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
    // eslint-disable-next-line
    typeof data.payload.tosAgreement === 'boolean' &&
    data.payload.tosAgreement === true
      ? true
      : false

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure that the user doesnt already exist
    _data.read('users', phone, (err, createuserdata) => {
      if (err) {
        // Hash the password
        const hashedPassword = helpers.hash(password)

        // Create the user object
        if (hashedPassword) {
          const userObject = {
            firstName,
            lastName,
            phone,
            hashedPassword,
            tosAgreement: true,
          }

          // Store the user
          _data.create('users', phone, userObject, (errCreate) => {
            if (!errCreate) {
              callback(200)
            } else {
              console.log(errCreate)
              callback(500, { Error: 'Could not create the new user' })
            }
          })
        } else {
          callback(500, { Error: "Could not hash the user's password" })
        }
      } else {
        // Users already exists
        callback(400, { Error: 'A user with that phone number already exists' })
      }
    })
  } else {
    callback(400, { Error: 'Missing required fields' })
  }
}

// Users - get
// Required data: phone
// Optional data: none
// @TODO Only let an authenticated user access their user
// object, don't let them access anyone elses
handlers._users.get = function (data, callback) {
  // Check that the phone number is valid
  const phone =
    typeof data.queryStringObject.phone === 'string' &&
    data.queryStringObject.phone.trim().length === 10
      ? data.queryStringObject.phone.trim()
      : false

  if (phone) {
    // Lookup the user
    _data.read('users', phone, (err, userdata) => {
      if (!err && userdata) {
        // Remove the hashed password from the user object before returning it to the requester
        // eslint-disable-next-line no-param-reassign
        delete userdata.hashedPassword
        callback(200, userdata)
      } else {
        callback(404)
      }
    })
  } else {
    callback(400, { Error: 'Missing required field' })
  }
}

// Users - put
// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
// @TODO Only let an authenticated user update their own object, don't let them update anyone elses
handlers._users.put = function (data, callback) {
  // Check for the required field
  const phone =
    typeof data.payload.phone === 'string' &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false

  // Check for the optional fields
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
  const password =
    typeof data.payload.password === 'string' &&
    data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false

  // Error if the phone is invalid
  if (phone) {
    // Error if nothing is sent to update
    if (firstName || lastName || password) {
      // Lookup the user
      _data.read('users', phone, (userErr, userData) => {
        if (!userErr && userData) {
          const updatedUserData = userData
          // Update the fields if necessary
          if (firstName) {
            updatedUserData.firstName = firstName
          }
          if (lastName) {
            updatedUserData.lastName = lastName
          }
          if (password) {
            updatedUserData.password = password
          }

          // Store the new updates
          _data.update('users', phone, updatedUserData, (updateErr) => {
            if (!updateErr) {
              callback(200)
            } else {
              console.log(updateErr)
              callback(500, { Error: 'Could not update the user' })
            }
          })
        } else {
          callback(400, { Error: 'The specified user does not exist' })
        }
      })
    } else {
      callback(400, { Error: 'Missing fields to update' })
    }
  } else {
    callback(400, { Error: 'Missing required field' })
  }
}

// Users - delete
// Required field: phone
// @TODO Only let an authenticated user delete their object, don't let them delete anyone elses
// @TODO Cleanup (delete) any other data files associated with this user
handlers._users.delete = function (data, callback) {
  // Check that the phone number is valid
  const phone =
    typeof data.queryStringObject.phone === 'string' &&
    data.queryStringObject.phone.trim().length === 10
      ? data.queryStringObject.phone.trim()
      : false

  if (phone) {
    // Lookup the user
    _data.read('users', phone, (err, userData) => {
      if (!err && userData) {
        _data.delete('users', phone, (deleteErr) => {
          if (!deleteErr) {
            callback(200)
          } else {
            callback(500, { Error: 'Could not delete the specified user' })
          }
        })
      } else {
        callback(400, { Error: 'Could not find the specified user' })
      }
    })
  } else {
    callback(400, { Error: 'Missing required field' })
  }
}

handlers.ping = function (data, callback) {
  // Callback a http status code, and a payload object
  callback(200, { name: 'ping' })
}
handlers.notFound = function (data, callback) {
  callback(404)
}

module.exports = handlers
