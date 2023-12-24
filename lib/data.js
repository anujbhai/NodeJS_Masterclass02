/*
 * Library for storing and editing data
 * */

// Dependencies
const util = require('util')
const fs = require('fs')
const path = require('path')

// Container for the module (to be exported)
const lib = {}

// Base directory of the data folder
lib.baseDir = path.join(__dirname, '/../.data/')

// Write data to a file
lib.create = async (dir, file, data) => {
  try {
    // --- Open the file for writing ---
    const fileDescriptor = await util.promisify(fs.open)(
      `${lib.baseDir}${dir}/${file}.json`,
      'wx'
    )

    // --- Convert data to string ---
    const stringData = JSON.stringify(data)

    // --- Write to file and close it ---
    await util.promisify(fs.writeFile)(fileDescriptor, stringData)

    return false
  } catch (err) {
    let errMsg = ''
    if (err.code === 'EEXIST') {
      errMsg = 'Could not create new file, it may already exist'
    } else {
      errMsg = `Error writiing to new file ${err.message}`
    }
    return errMsg
  }
}

// Read data from a file
lib.read = async (dir, file) => {
  try {
    const data = await fs.promises.readFile(
      `${lib.baseDir}${dir}/${file}.json`,
      'utf8'
    )
    return data
  } catch (err) {
    return err
  }
}

// Update data inside a file
lib.update = async (dir, file, data) => {
  // --- Open the file for writing ---
  // eslint-disable-next-line consistent-return
  fs.open(`${lib.baseDir}${dir}/${file}.json`, 'r+', (err, fileDescriptor) => {
    if (err && !fileDescriptor) {
      return 'Could not open the file for updating, it may not exist yet'
    }

    const stringData = JSON.stringify(data)

    // --- Truncate the file ---
    // eslint-disable-next-line consistent-return
    fs.ftruncate(fileDescriptor, 0, (errTruncate) => {
      if (errTruncate) {
        return 'Error truncating file'
      }

      // --- Write to the file and close it ---
      // eslint-disable-next-line consistent-return
      fs.writeFile(fileDescriptor, stringData, (errWrite) => {
        if (errWrite) {
          return 'Error writing to existing file'
        }

        fs.close(fileDescriptor, (errClose) => {
          if (errClose) {
            return 'Error closing the file'
          }
          return false
        })
      })
    })
  })
}

// Delete a file
lib.delete = async (dir, file) => {
  fs.unlink(`${lib.baseDir}${dir}/${file}.json`, (err) => {
    if (err) {
      return 'Error deleting file'
    }
    return false
  })
}

// Export the module
module.exports = lib
