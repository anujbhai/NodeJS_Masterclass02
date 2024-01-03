/*
 * Library for storing and editing data
 * */

// Dependencies
const fs = require('fs')
const path = require('path')

const helpers = require('./helpers')

// Container for the module (to be exported)
const lib = {}

// Base directory of the data folder
lib.baseDir = path.join(__dirname, '/../.data/')

// Write data to a file
lib.create = function (dir, file, data, callback) {
  // --- Open the file for writing ---
  fs.open(`${lib.baseDir}${dir}/${file}.json`, 'wx', (err, fileDescriptor) => {
    if (!err && fileDescriptor) {
      // --- Convert data to string ---
      const stringData = JSON.stringify(data)

      // --- Write to file and close it ---
      fs.writeFile(fileDescriptor, stringData, (errWrite) => {
        if (!errWrite) {
          fs.close(fileDescriptor, (errClose) => {
            if (!errClose) {
              callback(false)
            } else {
              callback('Error closing new file')
            }
          })
        } else {
          callback('Error writing to new file')
        }
      })
    } else {
      callback('Could not create new file, it may already exist')
    }
  })
}

// Read data from a file
lib.read = function (dir, file, callback) {
  fs.readFile(`${lib.baseDir}${dir}/${file}.json`, 'utf8', (err, data) => {
    if (!err && data) {
      const parsedData = helpers.parseJsonToObject(data)
      callback(false, parsedData)
    } else {
      callback(err, data)
    }
  })
}

// Update data inside a file
lib.update = function (dir, file, data, callback) {
  // --- Open the file for writing ---
  fs.open(`${lib.baseDir}${dir}/${file}.json`, 'r+', (err, fileDescriptor) => {
    if (!err && fileDescriptor) {
      // --- Convert data to string ---
      const stringData = JSON.stringify(data)

      // --- Truncate the file ---
      fs.ftruncate(fileDescriptor, (errTruncate) => {
        if (!errTruncate) {
          // --- Write to file and close it ---
          fs.writeFile(fileDescriptor, stringData, (errWrite) => {
            if (!errWrite) {
              fs.close(fileDescriptor, (errClose) => {
                if (!errClose) {
                  callback(false)
                } else {
                  callback('Error closing existing file')
                }
              })
            } else {
              callback('Error writing to existing file')
            }
          })
        } else {
          callback('Error truncating file')
        }
      })
    } else {
      callback('Could not open the file for updating, it may not exist yet')
    }
  })
}

// Delete a file
lib.delete = function (dir, file, callback) {
  fs.unlink(`${lib.baseDir}${dir}/${file}.json`, (err) => {
    callback(err)
  })
}

// Export the module
module.exports = lib
