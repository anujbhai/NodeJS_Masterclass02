/*
 * Library for storing and editing data
 * */

// Dependencies
const fs = require('fs').promises
const path = require('path')

// Container for the module (to be exported)
const lib = {}

// Base directory of the data folder
lib.baseDir = path.join(__dirname, '/../.data/')

// Write data to a file
lib.create = async (dir, file, data) => {
  try {
    // --- Open the file for writing ---
    const fileDescriptor = await fs.open(
      `${lib.baseDir}${dir}/${file}.json`,
      'wx'
    )

    // --- Convert data to string ---
    const stringData = JSON.stringify(data)

    // --- Write to file and close it ---
    await fs.writeFile(fileDescriptor, stringData)

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

lib.read = async (dir, file) => {
  try {
    const data = await fs.readFile(`${lib.baseDir}${dir}/${file}.json`, 'utf8')
    return data
  } catch (err) {
    return err
  }
}

lib.update = async (dir, file, data) => {
  try {
    const fileDescriptor = await fs.open(
      `${lib.baseDir}${dir}/${file}.json`,
      'r+'
    )

    // --- Convert data to string ---
    const stringData = JSON.stringify(data)

    // --- Truncate the file ---
    await fs.ftruncate(fileDescriptor, 0)

    // --- Write to the file and close it ---
    await fs.writeFile(fileDescriptor, stringData)
    await fs.close(fileDescriptor)

    return false
  } catch (err) {
    return 'Could not open the file for updating, it may not exist yet'
  }
}

// Export the module
module.exports = lib
