// This script updates the index files list.js and list.txt in the directories containing binaries,
// as well as the 'latest' and 'nightly' symlinks/files.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import {
  readlinkSync,
  unlinkSync,
  symlinkSync,
  readFileSync,
  writeFile,
  readdir,
  stat,
  lstat
} from 'fs'

import semver from 'semver'
import swarmhash from 'swarmhash'
import { readFile as readFileAsync } from 'node:fs/promises'
import { keccak, sha256 } from 'ethereumjs-util'
import { importer } from 'ipfs-unixfs-importer'
import { MemoryBlockstore } from 'blockstore-core/memory'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ipfsHash = async (content) => {
  const iterator = importer([{ content }], new MemoryBlockstore(), { onlyHash: true })
  const { value, done } = await iterator.next()
  if (done) {
    throw new Error('Failed to calculate an IPFS hash.')
  }
  await iterator.return()
  return value.cid.toString()
}

function generateLegacyListJS (builds, releases) {
  return `
var soljsonSources = ${JSON.stringify(builds, null, 2)};
var soljsonReleases = ${JSON.stringify(releases, null, 2)};

if (typeof(module) !== 'undefined')
  module.exports = {
    'allVersions': soljsonSources,
    'releases': soljsonReleases
  };
`
}

function updateSymlinkSync (linkPathRelativeToRoot, targetRelativeToLink) {
  const absoluteLinkPath = join(__dirname, linkPathRelativeToRoot)
  let linkString

  try {
    linkString = readlinkSync(absoluteLinkPath)

    if (targetRelativeToLink !== linkString) {
      unlinkSync(absoluteLinkPath)
      console.log('Removed link ' + linkPathRelativeToRoot + ' -> ' + linkString)
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err
    }
  }

  if (targetRelativeToLink !== linkString) {
    symlinkSync(targetRelativeToLink, absoluteLinkPath, 'file')
    console.log('Created link ' + linkPathRelativeToRoot + ' -> ' + targetRelativeToLink)
  }
}

function updateCopy (srcRelativeToRoot, destRelativeToRoot) {
  readFileSync(join(__dirname, srcRelativeToRoot), function (err, data) {
    if (err) {
      throw err
    }

    const absoluteDest = join(__dirname, destRelativeToRoot)
    stat(absoluteDest, function (err, stats) {
      if (err && err.code !== 'ENOENT') {
        throw err
      }

      // If the target is a symlink, we want to replace it with a copy rather than overwrite the file it links to
      if (!err && stats.isSymbolicLink()) {
        unlinkSync(absoluteDest)
      }

      writeFile(absoluteDest, data, function (err) {
        if (err) {
          throw err
        }
        console.log('Updated ' + destRelativeToRoot)
      })
    })
  })
}

function deleteIfExists (filePathRelativeToRoot) {
  const absoluteFilePath = join(__dirname, filePathRelativeToRoot)

  lstat(absoluteFilePath, function (err, stats) {
    if (err && err.code !== 'ENOENT') {
      throw err
    }

    if (!err) {
      console.log('Deleted ' + filePathRelativeToRoot)
      unlinkSync(absoluteFilePath)
    }
  })
}

function buildVersion (build) {
  let version = build.version
  if (build.prerelease && build.prerelease.length > 0) {
    version += '-' + build.prerelease
  }
  if (build.build && build.build.length > 0) {
    version += '+' + build.build
  }
  return version
}

async function makeEntry (dir, parsedFileName, oldList) {
  const pathRelativeToRoot = join(dir, parsedFileName[0])
  const absolutePath = join(__dirname, pathRelativeToRoot)

  const build = {
    path: parsedFileName[0],
    version: parsedFileName[1],
    prerelease: parsedFileName[3],
    build: parsedFileName[5]
  }
  build.longVersion = buildVersion(build)

  if (oldList) {
    const entries = oldList.builds.filter(entry => (entry.path === parsedFileName[0]))
    if (entries) {
      if (entries.length >= 2) {
        throw Error("Found multiple list.json entries for binary '" + pathRelativeToRoot + "'")
      } else if (entries.length === 1) {
        build.keccak256 = entries[0].keccak256
        build.sha256 = entries[0].sha256
        build.urls = entries[0].urls
      }
    }
  }

  if (!build.sha256 || !build.keccak256 || !build.urls || build.urls.length !== 2) {
    const fileContent = await readFileAsync(absolutePath)
    build.keccak256 = '0x' + keccak(fileContent).toString('hex')
    console.log("Computing hashes of '" + pathRelativeToRoot + "'")
    build.sha256 = '0x' + sha256(fileContent).toString('hex')
    build.urls = [
      'bzzr://' + swarmhash(fileContent).toString('hex'),
      'dweb:/ipfs/' + await ipfsHash(fileContent)
    ]
  }

  return build
}

async function batchedAsyncMap (values, batchSize, asyncMapFunction) {
  if (batchSize === null) {
    batchSize = values.length
  }

  let results = []
  for (let i = 0; i < values.length; i += batchSize) {
    results = results.concat(await Promise.all(values.slice(i, i + batchSize).map(asyncMapFunction)))
  }
  return results
}

function processDir (dir, options, listCallback) {
  readdir(join(__dirname, dir), { withFileTypes: true }, async function (err, files) {
    if (err) {
      throw err
    }

    let oldList
    if (options.reuseHashes) {
      try {
        oldList = JSON.parse(readFileSync(join(__dirname, dir, '/list.json')))
      } catch (err) {
        // Not being able to read the existing list is not a critical error.
        // We'll just recreate it from scratch.
      }
    }

    const binaryPrefix = (dir === '/bin' || dir === '/wasm' ? 'soljson' : 'solc-' + dir.slice(1))
    const binaryExtensions = {
      '/bin': ['.js'],
      '/wasm': ['.js'],
      '/emscripten-asmjs': ['.js'],
      '/emscripten-wasm32': ['.js'],
      '/windows-amd64': ['.zip', '.exe'],
      '/linux-amd64': [''],
      '/macosx-amd64': ['']
    }[dir] || ''

    // ascending list (oldest version first)
    const parsedFileNames = files
      .filter(function (file) {
        // Skip symbolic links with less then 8 characters in the commit hash.
        // They exist only for backwards-compatibilty and should not be on the list.
        return dir !== '/bin' ||
          !file.isSymbolicLink() ||
          file.name.match(/^.+\+commit\.[0-9a-f]{8,}\.js$/)
      })
      .map(function (file) { return file.name })
      .map(function (binaryName) {
        const escapedExtensions = binaryExtensions.map(function (binaryExtension) {
          return binaryExtension.replace('.', '\\.')
        })
        return binaryName.match(new RegExp('^' + binaryPrefix + '-v([0-9.]*)(-([^+]*))?(\\+(.*))?(' + escapedExtensions.join('|') + ')$'))
      })
      .filter(function (matchResult) { return matchResult !== null })

    const parsedList = (await batchedAsyncMap(parsedFileNames, options.maxFilesPerBatch, async function (matchResult) {
      return await makeEntry(dir, matchResult, oldList)
    }))
      .sort(function (a, b) {
        if (a.longVersion === b.longVersion) {
          return 0
        }

        // NOTE: a vs. b (the order is important), because we want oldest first on parsedList.
        // NOTE: If semver considers two versions equal we don't have enough info to say which came earlier
        // so we don't care about their relative order as long as it's deterministic.
        return semver.compare(a.longVersion, b.longVersion) || (a.longVersion > b.longVersion ? -1 : 1)
      })

    // When the list is ready, let the callback process it
    if (listCallback !== undefined) {
      listCallback(parsedList)
    }

    // descending list
    const releases = parsedList
      .slice()
      .reverse()
      .reduce(function (prev, next) {
        if (next.prerelease === undefined) {
          prev[next.version] = next.path
        }
        return prev
      }, {})

    // descending list
    const buildNames = parsedList
      .slice()
      .reverse()
      .map(function (listEntry) { return listEntry.path })

    const latestRelease = parsedList
      .slice()
      .reverse()
      .filter(function (listEntry) {
        if (listEntry.prerelease === undefined) {
          return listEntry
        }
        return undefined
      })
      .map(function (listEntry) {
        return listEntry.version
      })[0]

    // latest build (nightly)
    const latestBuildFile = buildNames[0]

    // latest release
    const latestReleaseFile = releases[latestRelease]

    // Write list.txt
    // A descending list of file names.
    writeFile(join(__dirname, dir, '/list.txt'), buildNames.join('\n'), function (err) {
      if (err) {
        throw err
      }
      console.log('Updated ' + dir + '/list.txt')
    })

    // Write bin/list.json
    // Ascending list of builds and descending map of releases.
    writeFile(join(__dirname, dir, '/list.json'), JSON.stringify({ builds: parsedList, releases: releases, latestRelease: latestRelease }, null, 2), function (err) {
      if (err) {
        throw err
      }
      console.log('Updated ' + dir + '/list.json')
    })

    // Write bin/list.js
    // Descending list of build filenames and descending map of releases.
    writeFile(join(__dirname, dir, '/list.js'), generateLegacyListJS(buildNames, releases), function (err) {
      if (err) {
        throw err
      }
      console.log('Updated ' + dir + '/list.js')
    })

    // Update 'latest' symlink (except for wasm/ where the link is hard-coded to point at the one in bin/).
    // bin/ is a special case because we need to keep a copy rather than a symlink. The reason is that
    // some tools (in particular solc-js) have hard-coded github download URLs to it and can't handle symlinks.
    if (dir !== '/wasm') {
      const releaseExtension = binaryExtensions.find(function (extension) { return latestReleaseFile.endsWith(extension) })

      binaryExtensions.forEach(function (extension) {
        if (extension !== releaseExtension) {
          deleteIfExists(join(dir, binaryPrefix + '-latest' + extension))
        }
      })

      if (dir === '/bin') {
        updateCopy(join(dir, latestReleaseFile), join(dir, binaryPrefix + '-latest' + releaseExtension))
      } else {
        updateSymlinkSync(join(dir, binaryPrefix + '-latest' + releaseExtension), latestReleaseFile)
      }
    }

    // Update 'nightly' symlink in bin/ (we don't have nightlies for other platforms)
    if (dir === '/bin') {
      const nightlyExtension = binaryExtensions.find(function (extension) { return latestBuildFile.endsWith(extension) })

      binaryExtensions.forEach(function (extension) {
        if (extension !== nightlyExtension) {
          deleteIfExists(join(dir, binaryPrefix + '-latest' + extension))
        }
      })

      updateSymlinkSync(join(dir, binaryPrefix + '-nightly' + nightlyExtension), latestBuildFile)
    }
  })
}

function parseCommandLine () {
  let reuseHashes
  let maxFilesPerBatch

  for (let i = 2; i < process.argv.length; ++i) {
    if (process.argv[i] === '--reuse-hashes') {
      reuseHashes = true
    } else if (process.argv[i] === '--max-files-per-batch') {
      if (i + 1 >= process.argv.length) {
        console.error('Expected an integer argument after --max-files-per-batch.')
        process.exit(1)
      }

      maxFilesPerBatch = parseInt(process.argv[i + 1], 10)
      if (isNaN(maxFilesPerBatch) || maxFilesPerBatch <= 0) {
        console.error("Expected the argument of --max-files-per-batch to be a positive integer, got '" + process.argv[i + 1] + "'.")
        process.exit(1)
      }
      ++i
    } else {
      console.error("Invalid option: '" + process.argv[i] + "'.")
      process.exit(1)
    }
  }

  // Defaults
  if (reuseHashes === undefined) {
    reuseHashes = false
  }
  if (maxFilesPerBatch === undefined) {
    maxFilesPerBatch = null // no limit
  }

  return {
    reuseHashes: reuseHashes,
    maxFilesPerBatch: maxFilesPerBatch
  }
}

const DIRS = [
  '/bin',
  '/linux-amd64',
  '/macosx-amd64',
  '/windows-amd64'
]

const options = parseCommandLine()

DIRS.forEach(function (dir) {
  if (dir !== '/bin') {
    processDir(dir, options)
  } else {
    processDir(dir, options, function (parsedList) {
      // Any new releases added to bin/ need to be linked in other directories before we can start processing them.
      parsedList.forEach(function (release) {
        if (release.prerelease === undefined) {
          // Starting with 0.6.2 we no longer build asm.js releases and the new builds added to bin/ are all wasm.
          if (semver.gt(release.version, '0.6.1')) {
            updateSymlinkSync(
              join('/wasm', release.path),
              join('..', 'bin', release.path)
            )
          } else {
            updateSymlinkSync(
              join('/emscripten-asmjs', 'solc-emscripten-asmjs-v' + release.longVersion + '.js'),
              join('..', 'bin', release.path)
            )
          }
        }
      })

      processDir('/emscripten-asmjs', options)
      processDir('/wasm', options, function (parsedList) {
        // Any new releases added to wasm/ need to be linked in emscripten-wasm32/ first.
        parsedList.forEach(function (release) {
          if (release.prerelease === undefined) {
            updateSymlinkSync(
              join('/emscripten-wasm32', 'solc-emscripten-wasm32-v' + release.longVersion + '.js'),
              join('..', 'wasm', release.path)
            )
          }
        })

        processDir('/emscripten-wasm32', options)
      })
    })
  }
})
