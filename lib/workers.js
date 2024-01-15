/*
 * Worker related tasks
 * */

// ---- Dependencies ----
// const path = require('path')
// const fs = require('fs')
const http = require('http')
const https = require('https')
const url = require('url')

const _data = require('./data')
const helpers = require('./helpers')

// ---- Instantiate the worker object ----
const workers = {}

// ---- Lookup all checks, get their data, send to a validator
workers.gatherAllChecks = () => {
  // Get all the checks
  _data.list('checks', (err, checks) => {
    if (!err && checks && checks.length > 0) {
      checks.forEach((check) => {
        // read in the check data
        _data.read('checks', check, (readErr, originalCheckData) => {
          if (!readErr && originalCheckData) {
            // pass it to the check validator
            workers.validateCheckData(originalCheckData)
          } else {
            console.log("Error reading one of the check's data.")
          }
        })
      })
    } else {
      console.log('Error: Could not find any checks to process.')
    }
  })
}

// ---- Sanity-checking the check data
workers.validateCheckData = (originalCheckData) => {
  let origChDataParam = originalCheckData

  origChDataParam =
    typeof origChDataParam === 'object' && origChDataParam !== null
      ? origChDataParam
      : {}
  origChDataParam.id =
    typeof origChDataParam.id === 'string' &&
      origChDataParam.id.trim().length === 20 // eslint-disable-line
      ? origChDataParam.id.trim()
      : false
  origChDataParam.userPhone =
    typeof origChDataParam.userPhone === 'string' &&
      origChDataParam.userPhone.trim().length === 10 // eslint-disable-line
      ? origChDataParam.userPhone.trim()
      : false
  origChDataParam.protocol =
    typeof origChDataParam.protocol === 'string' &&
      ['https', 'http'].indexOf(origChDataParam.protocol) > -1 // eslint-disable-line
      ? origChDataParam.protocol
      : false
  origChDataParam.url =
    typeof origChDataParam.url === 'string' &&
      origChDataParam.url.trim().length > 0 // eslint-disable-line
      ? origChDataParam.url.trim()
      : false
  origChDataParam.method =
    typeof origChDataParam.method === 'string' &&
      ['get', 'post', 'put', 'delete'].indexOf(origChDataParam.method) > -1 // eslint-disable-line
      ? origChDataParam.method
      : false
  origChDataParam.successCodes =
    typeof origChDataParam.successCodes === 'object' &&
      origChDataParam.successCodes instanceof Array && // eslint-disable-line
      origChDataParam.successCodes.length > 0 // eslint-disable-line
      ? origChDataParam.successCodes
      : false
  origChDataParam.timeoutSeconds =
    typeof origChDataParam.timeoutSeconds === 'number' &&
      origChDataParam.timeoutSeconds % 1 === 0 && // eslint-disable-line
      origChDataParam.timeoutSeconds > 1 && // eslint-disable-line
      origChDataParam.timeoutSeconds <= 5 // eslint-disable-line

      ? origChDataParam.timeoutSeconds
      : false

  // Set the keys that may not be set (if the workers have never seen this check before)
  origChDataParam.state =
    typeof origChDataParam.state === 'string' &&
      ['up', 'down'].indexOf(origChDataParam.state) > -1 // eslint-disable-line
      ? origChDataParam.state
      : 'down'
  origChDataParam.lastChecked =
    typeof origChDataParam.lastChecked === 'number' &&
      origChDataParam.lastChecked > 0 // eslint-disable-line
      ? origChDataParam.lastChecked
      : false

  // if all the checks pass, pass the data along to the next step in the proceess
  if (
    origChDataParam.id &&
    origChDataParam.userPhone &&
    origChDataParam.protocol &&
    origChDataParam.url &&
    origChDataParam.method &&
    origChDataParam.successCodes &&
    origChDataParam.timeoutSeconds
  ) {
    workers.performCheck(origChDataParam)
  } else {
    console.log('Error: One of the checks is not properly formatted.')
  }
}

// ---- Perform the check, send the originalCheckData and the outcome of the check process ----
workers.performCheck = (originalCheckData) => {
  // prepare the initial check outcome
  const checkOutcome = {
    error: false,
    responseCode: false,
  }
  // mark the outcome as not sent yet
  let outcomeSent = false
  // Parse the hostname and the path out of the original check data
  const parsedUrl = url.parse(
    `${originalCheckData.protocol}://${originalCheckData.url}`,
    true
  )
  const hostName = parsedUrl.hostname
  const parsedUrlpath = parsedUrl.path

  // construct the request
  const requestDetails = {
    protocol: `${originalCheckData.protocol}:`,
    hostname: hostName,
    method: originalCheckData.method.toUpperCase(),
    path: parsedUrlpath,
    timeout: originalCheckData.timeoutSeconds * 1000,
  }

  // instantiate the request object (using http/https)
  const _moduleToUse = originalCheckData.protocol === 'http' ? http : https

  const req = _moduleToUse.request(requestDetails, (res) => {
    // grab the status of the sent request
    const status = res.statusCode

    // update the checkOutcome and pass the data along
    checkOutcome.responseCode = status

    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome)
      outcomeSent = true
    }
  })

  // Bind to the error event so it doesn't get thrown
  req.on('error', (e) => {
    // update the checkOutcome and pass the data along
    checkOutcome.error = {
      error: true,
      value: e,
    }

    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome)
      outcomeSent = true
    }
  })

  // Bind to the timeout event
  req.on('timeout', () => {
    // update the checkOutcome and pass the data along
    checkOutcome.error = {
      error: true,
      value: 'timeout',
    }

    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome)
      outcomeSent = true
    }
  })

  // End the request
  req.end()
}

// ---- Process the check outcome, update check data and trigger an alert when needed ----
workers.processCheckOutcome = (originalCheckData, checkOutcome) => {
  // Decide if the check is considered up/down
  const state =
    !checkOutcome.error &&
      checkOutcome.responseCode && // eslint-disable-line
      originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 // eslint-disable-line
      ? 'up'
      : 'down'

  // Decide if an alert is warranted
  const alertWarranted =
    originalCheckData.lastChecked && // eslint-disable-line
      originalCheckData.state !== state // eslint-disable-line
      ? true // eslint-disable-line
      : false // eslint-disable-line

  // Update the check data
  const newCheckData = originalCheckData
  newCheckData.state = state
  newCheckData.lastChecked = Date.now()

  // Save the updated
  _data.update('checks', newCheckData.id, newCheckData, (updateErr) => {
    if (!updateErr) {
      // Send the new check data to the next phase in the process if needed
      if (alertWarranted) {
        workers.alertUserToStatusChange(newCheckData)
      } else {
        console.log('Check outcome has not changed, no alert needed.')
      }
    } else {
      console.log('Error trying to save updates to one of the checks.')
    }
  })
}

// ---- Alert the user as to a change in their check status ----
workers.alertUserToStatusChange = (newCheckData) => {
  const msg = `Alert: Your check for ${newCheckData.method.toUpperCase} ${newCheckData.protocol}://${newCheckData.url} is currently ${newCheckData.state}`

  helpers.sendTwilioSms(newCheckData.userPhone, msg, (err) => {
    if (!err) {
      console.log(
        'Success: User was alerted to a status change in their check, via sms.',
        msg
      )
    } else {
      console.log(
        'Error: Could not send sms alert to user who had a state change in their check.',
        err
      )
    }
  })
}

// ---- Timer to execute the worker-process once per minute
workers.loop = () => {
  setInterval(() => {
    workers.gatherAllChecks()
  }, 1000 * 60)
}

// ---- Init script ----
workers.init = () => {
  // execute all the checks immediately
  workers.gatherAllChecks()

  // call the loop so the checks will execute later on
  workers.loop()
}

// ---- Export the module ----
module.exports = workers
