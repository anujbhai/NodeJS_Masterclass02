/*
 * Library for storing and rotating logs
 * */

// ---- Dependencies ----
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// ---- Container for the module ----
const lib = {}

// ---- Base dir for the logs folder ----
lib.baseDir = path.join(__dirname, '/../.logs/')

// ---- Append a string to a file. Create the file if it does not exist ----
lib.append = (file, str, callback) => {
  // Open file for appending
  fs.open(`${lib.baseDir}${file}.log`, 'a', (openErr, fileDescriptor) => {
    if (!openErr && fileDescriptor) {
      // Append to the file and close it
      fs.appendFile(fileDescriptor, `${str}\n`, (appendErr) => {
        if (!appendErr) {
          fs.close(fileDescriptor, (closeErr) => {
            if (!closeErr) {
              callback(false)
            } else {
              callback('Error closing file that was being appended.')
            }
          })
        } else {
          callback('Error appending to file.')
        }
      })
    } else {
      callback('Could not open file for appending.')
    }
  })
}

// ---- List all logs and optionally include the compressed logs ----
lib.list = (includeCompressedLogs, callback) => {
  fs.readdir(lib.baseDir, (err, data) => {
    if (!err && data && data.length > 0) {
      const trimmedFileNames = []

      data.forEach((fileName) => {
        // add the .log files
        if (fileName.indexOf('.log') > -1) {
          trimmedFileNames.push(fileName.replace('.log', ''))
        }

        // add on the .gz
        if (fileName.indexOf('.gz.b64') > -1 && includeCompressedLogs) {
          trimmedFileNames.push(fileName.replace('.gz.b64'), '')
        }
      })

      callback(false, trimmedFileNames)
    } else {
      callback(err, data)
    }
  })
}

// ---- Compress the contents of one .log file into a .gz.b64 file within the same directory ----
lib.compress = (logId, newFileId, callback) => {
  const sourceFile = `${logId}.log`
  const destFile = `${newFileId}.gz.b64`

  // Read the source file
  fs.readFile(`${lib.baseDir}${sourceFile}`, 'utf8', (err, inputString) => {
    if (!err && inputString) {
      // compress the data using gzip
      zlib.gzip(inputString, (zipErr, buffer) => {
        if (!zipErr && buffer) {
          // send the compressed data to destination file
          fs.open(
            `${lib.baseDir}${destFile}`,
            'wx',
            (openErr, fileDescriptor) => {
              if (!openErr && fileDescriptor) {
                // Write to the destination file
                fs.writeFile(
                  fileDescriptor,
                  buffer.toString('base64'),
                  (writeErr) => {
                    if (!writeErr) {
                      // Close the destination file
                      fs.close(fileDescriptor, (closeErr) => {
                        if (!closeErr) {
                          callback(false)
                        } else {
                          callback(closeErr)
                        }
                      })
                    } else {
                      callback(writeErr)
                    }
                  }
                )
              } else {
                callback(openErr)
              }
            }
          )
        } else {
          callback(zipErr)
        }
      })
    } else {
      callback(err)
    }
  })
}

// ---- Decompress the contents of a .gz.b64 file into a string variable ----
lib.decompress = (fileId, callback) => {
  const fileName = `${fileId}.gz.b64`

  fs.readFile(`${lib.baseDir}${fileName}`, 'utf8', (err, str) => {
    if (!err && str) {
      // Decompress the data
      const inputBuffer = Buffer.from(str, 'base64')

      zlib.unzip(inputBuffer, (unzipErr, outputBuffer) => {
        if (!unzipErr && outputBuffer) {
          const outputStr = outputBuffer.toString()

          callback(false, outputStr)
        } else {
          callback(unzipErr)
        }
      })
    } else {
      callback(err)
    }
  })
}

// ---- x ----
lib.truncate = (logId, callback) => {
  fs.open(`${lib.baseDir}${logId}.log`, 'r+', (err, fd) => {
    if (!err) {
      fs.ftruncate(fd, 0, (truncateErr) => {
        if (!truncateErr) {
          fs.close(fd, (closeErr) => {
            if (!closeErr) {
              callback(false)
            } else {
              callback(closeErr)
            }
          })
        } else {
          fs.close(fd, (closeErr) => {
            callback(truncateErr || closeErr)
          })
        }
      })
    } else {
      callback(err)
    }
  })
}

// ---- Export the module ----
module.exports = lib
