#!/usr/bin/env node
'use strict'
const fs = require('fs')
const path = require('path')
const ethUtil = require('ethereumjs-util')
const ipfsImporter = require('ipfs-unixfs-importer')
const util = require('util')
const inMemory = require('ipld-in-memory')
const swarmhash = require('swarmhash')
const IPLD = require('ipld')
const workerpool = require('workerpool')

const readFile = util.promisify(fs.readFile)

async function workerMain (dir, batch, oldList) {
  return await Promise.all(batch.map(item => makeEntry(dir, item, oldList)))
}

async function makeEntry (dir, parsedFileName, oldList) {
  const pathRelativeToRoot = path.join(dir, parsedFileName[0])
  const absolutePath = path.join(__dirname, pathRelativeToRoot)

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
    const fileContent = await readFile(absolutePath)
    build.keccak256 = '0x' + ethUtil.keccak(fileContent).toString('hex')
    console.log("Computing hashes of '" + pathRelativeToRoot + "'")
    build.sha256 = '0x' + ethUtil.sha256(fileContent).toString('hex')
    build.urls = [
      'bzzr://' + swarmhash(fileContent).toString('hex'),
      'dweb:/ipfs/' + await ipfsHash(fileContent)
    ]
  }

  return build
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

async function ipfsHash (content) {
  const iterator = ipfsImporter.importer([{ content }], await inMemory(IPLD), { onlyHash: true })
  const { value, done } = await iterator.next()
  if (done) {
    throw new Error('Failed to calculate an IPFS hash.')
  }

  await iterator.return()
  return value.cid.toString()
}

workerpool.worker({
  workerMain
})
