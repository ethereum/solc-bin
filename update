#!/usr/bin/env node

'use strict'

const fs = require('fs')
const path = require('path')
const semver = require('semver')
const ethUtil = require('ethereumjs-util')
const swarmhash = require('swarmhash')

// This script updates the index files list.js and list.txt in the bin directory,
// as well as the soljson-latest.js files.

fs.readdir(path.join(__dirname, '/bin'), function (err, files) {
  if (err) {
    throw err
  }

  function buildVersion (build) {
    var version = build.version
    if (build.prerelease && build.prerelease.length > 0) {
      version += '-' + build.prerelease
    }
    if (build.build && build.build.length > 0) {
      version += '+' + build.build
    }
    return version
  }

  function readFile (file) {
    return fs.readFileSync(path.join(__dirname, '/bin', file))
  }

  // ascending list (oldest version first)
  const parsedList = files
    .map(function (file) { return file.match(/^soljson-v([0-9.]*)(-([^+]*))?(\+(.*))?.js$/) })
    .filter(function (version) { return version })
    .map(function (pars) { return { path: pars[0], version: pars[1], prerelease: pars[3], build: pars[5] } })
    .map(function (pars) {
      const fileContent = readFile(pars.path)
      pars.longVersion = buildVersion(pars)
      pars.keccak256 = '0x' + ethUtil.sha3(fileContent).toString('hex')
      pars.urls = [ 'bzzr://' + swarmhash(fileContent).toString('hex') ]
      return pars
    })
    .sort(function (a, b) {
      // NOTE: a vs. b (the order is important), because we want oldest first in the list
      return semver.compare(a.longVersion, b.longVersion)
    })

  // descending list
  const releases = parsedList
    .slice().reverse()
    .reduce(function (prev, next) {
      if (next.prerelease === undefined) {
        prev[next.version] = next.path
      }
      return prev
    }, {})

  // descending list
  const buildNames = parsedList
    .slice().reverse()
    .map(function (ver) { return ver.path })

  const latestRelease = parsedList
    .slice().reverse()
    .filter(function (version) {
      if (version.prerelease === undefined) {
        return version
      }
    })
    .map(function (version) {
      return version.version
    })[0]

  // latest build (nightly)
  const latestBuildFile = buildNames[0]

  // latest release
  const latestReleaseFile = releases[latestRelease]

  // Write bin/list.txt
  // A descending list of file names.
  fs.writeFile(path.join(__dirname, '/bin/list.txt'), buildNames.join('\n'), function (err) {
    if (err) {
      throw err
    }
    console.log('Updated bin/list.txt')
  })

  // Write bin/list.json
  // Ascending list of builds and descending map of releases.
  fs.writeFile(path.join(__dirname, '/bin/list.json'), JSON.stringify({ builds: parsedList, releases: releases, latestRelease: latestRelease }, null, 2), function (err) {
    if (err) {
      throw err
    }
    console.log('Updated bin/list.json')
  })

  // Write bin/list.js
  // Descending list of build filenames and descending map of releases.
  fs.writeFile(path.join(__dirname, '/bin/list.js'), generateLegacyListJS(buildNames, releases), function (err) {
    if (err) {
      throw err
    }
    console.log('Updated bin/list.js')
  })

  // Read latest release file
  fs.readFile(path.join(__dirname, '/bin/', latestReleaseFile), function (err, data) {
    if (err) {
      throw err
    }

    // Copy to bin/soljson-latest.js
    fs.writeFile(path.join(__dirname, '/bin/soljson-latest.js'), data, function (err) {
      if (err) {
        throw err
      }
      console.log('Updated bin/soljson-latest.js')
    })

    // Copy to soljson.js
    fs.writeFile(path.join(__dirname, '/soljson.js'), data, function (err) {
      if (err) {
        throw err
      }
      console.log('Updated soljson.js')
    })
  })

  // Read latest build file
  fs.readFile(path.join(__dirname, '/bin/', latestBuildFile), function (err, data) {
    if (err) {
      throw err
    }

    // Copy to bin/soljson-nightly.js
    fs.writeFile(path.join(__dirname, '/bin/soljson-nightly.js'), data, function (err) {
      if (err) {
        throw err
      }
      console.log('Updated bin/soljson-nightly.js')
    })
  })
})

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
