/*
 * Worker related tasks
 * */

// ---- Dependencies ----
// const path = require('path')
// const fs = require('fs')
const http = require('http')
const https = require('https')
const url = require('url')
const util = require('util')

const _data = require('./data')
const _logs = require('./logs')
const helpers = require('./helpers')

const debug = util.debuglog('workers')

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
            debug("Error reading one of the check's data.")
          }
        })
      })
    } else {
      debug('Error: Could not find any checks to process.')
    }
  })
}

// ---- Sanity-checking the check data
workers.validateCheckData = (originalCheckData) => {
  let origChDataParam = originalCheckData

  origChDataParam =
    typeof origChDataParam === 'object' && origChDataParam !== null
      ? originalCheckData
      : {}
  origChDataParam.id =
    typeof origChDataParam.id === 'string' &&
      origChDataParam.id.trim().length === 20 // eslint-disable-line
      ? originalCheckData.id.trim()
      : false
  origChDataParam.userPhone =
    typeof origChDataParam.userPhone === 'string' &&
      origChDataParam.userPhone.trim().length === 10 // eslint-disable-line
      ? originalCheckData.userPhone.trim()
      : false
  origChDataParam.protocol =
    typeof origChDataParam.protocol === 'string' &&
      ['http', 'https'].indexOf(origChDataParam.protocol) > -1 // eslint-disable-line
      ? originalCheckData.protocol
      : false
  origChDataParam.url =
    typeof origChDataParam.url === 'string' &&
      origChDataParam.url.trim().length > 0 // eslint-disable-line
      ? originalCheckData.url.trim()
      : false
  origChDataParam.method =
    typeof origChDataParam.method === 'string' &&
      ['post', 'get', 'put', 'delete'].indexOf(origChDataParam.method) > -1 // eslint-disable-line
      ? originalCheckData.method
      : false
  origChDataParam.successCodes =
    typeof origChDataParam.successCodes === 'object' &&
      origChDataParam.successCodes instanceof Array && // eslint-disable-line
      origChDataParam.successCodes.length > 0 // eslint-disable-line
      ? originalCheckData.successCodes
      : false
  origChDataParam.timeoutSeconds =
    typeof origChDataParam.timeoutSeconds === 'number' &&
      origChDataParam.timeoutSeconds % 1 === 0 && // eslint-disable-line
      origChDataParam.timeoutSeconds >= 1 && // eslint-disable-line
      origChDataParam.timeoutSeconds <= 5 // eslint-disable-line
      ? originalCheckData.timeoutSeconds
      : false

  // Set the keys that may not be set (if the workers have never seen this check before)
  origChDataParam.state =
    typeof origChDataParam.state === 'string' &&
      ['up', 'down'].indexOf(origChDataParam.state) > -1 // eslint-disable-line
      ? originalCheckData.state
      : 'down'
  origChDataParam.lastChecked =
    typeof origChDataParam.lastChecked === 'number' &&
      origChDataParam.lastChecked > 0 // eslint-disable-line
      ? originalCheckData.lastChecked
      : false

  // if all the checks pass, pass the data along to the next step in the proceess
  if (
    originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.protocol &&
    originalCheckData.url &&
    originalCheckData.method &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds
  ) {
    workers.performCheck(originalCheckData)
  } else {
    debug('Error: One of the checks is not properly formatted.')
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

  // Log the outcome
  const timeOfCheck = Date.now()

  workers.log(
    originalCheckData,
    checkOutcome,
    state,
    alertWarranted,
    timeOfCheck
  )

  // Update the check data
  const newCheckData = originalCheckData
  newCheckData.state = state
  newCheckData.lastChecked = timeOfCheck

  // Save the updated
  _data.update('checks', newCheckData.id, newCheckData, (updateErr) => {
    if (!updateErr) {
      // Send the new check data to the next phase in the process if needed
      if (alertWarranted) {
        workers.alertUserToStatusChange(newCheckData)
      } else {
        debug('Check outcome has not changed, no alert needed.')
      }
    } else {
      debug('Error trying to save updates to one of the checks.')
    }
  })
}

// ---- Alert the user as to a change in their check status ----
workers.alertUserToStatusChange = (newCheckData) => {
  const msg = `Alert: Your check for ${newCheckData.method.toUpperCase()} ${newCheckData.protocol}://${newCheckData.url} is currently ${newCheckData.state}` // eslint-disable-line

  helpers.sendTwilioSms(newCheckData.userPhone, msg, (err) => {
    if (!err) {
      debug(
        'Success: User was alerted to a status change in their check, via sms.',
        msg
      )
    } else {
      debug(
        'Error: Could not send sms alert to user who had a state change in their check.',
        err
      )
    }
  })
}

// ---- Log function ----
workers.log = (
  originalCheckData,
  checkOutcome,
  state,
  alertWarranted,
  timeOfCheck
) => {
  // Form the log data
  const logData = {
    check: originalCheckData,
    outcome: checkOutcome,
    state,
    alert: alertWarranted,
    time: timeOfCheck,
  }

  // Convert data to a string
  const logString = JSON.stringify(logData)

  // Determine log file name
  const logFileName = originalCheckData.id

  // Append the log string to the file
  _logs.append(logFileName, logString, (err) => {
    if (!err) {
      debug('Logging to the file succeeded.')
    } else {
      debug('Logging to the file failed.')
    }
  })
}

// ---- Timer to execute the worker-process once per minute
workers.loop = () => {
  setInterval(() => {
    workers.gatherAllChecks()
  }, 1000 * 60)
}

// ---- Timer to execute the log-rotation-process once per day
workers.logRotationLoop = () => {
  setInterval(
    () => {
      workers.rotateLogs()
    },
    1000 * 60 * 60 * 24
  )
}

// ---- Rotate(compress) the log files ----
workers.rotateLogs = () => {
  // List all the non-compressed log files
  _logs.list(false, (err, logs) => {
    if (!err && logs && logs.length > 0) {
      logs.forEach((logName) => {
        // compress the data to a different file
        const logId = logName.replace('.log', '')
        const newField = `${logId}-${Date.now()}`

        _logs.compress(logId, newField, (compressErr) => {
          if (!compressErr) {
            // Truncate the log
            _logs.truncate(logId, (truncateErr) => {
              if (!truncateErr) {
                debug('Success truncating log file')
              } else {
                debug('Error truncating log file')
              }
            })
          } else {
            debug('Error: compressing one of the log files.', err)
          }
        })
      })
    } else {
      debug('Error: could not find any logs to rotate.')
    }
  })
}

// ---- Init script ----
workers.init = () => {
  // send to console (yellowed)
  console.log('\x1b[33m%s\x1b[0m', 'Background workers are running.')

  // execute all the checks immediately
  workers.gatherAllChecks()

  // call the loop so the checks will execute later on
  workers.loop()

  // compress all the logs immediately
  workers.rotateLogs()

  // call the compression loop so logs will be compressed later on
  workers.logRotationLoop()
}

// ---- Export the module ----
module.exports = workers
