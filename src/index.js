'use strict'

const core = require('@actions/core')
const github = require('@actions/github')
const fetch = require('node-fetch')
const checkTargetMatchToPR = require('./lib/checkTargetMatchToPR')

const { logInfo, logWarning, logError } = require('./log')
const { getInputs } = require('./util')

const {
  GITHUB_TOKEN,
  MERGE_METHOD,
  EXCLUDE_PKGS,
  MERGE_COMMENT,
  APPROVE_ONLY,
  API_URL,
  TARGET
} = getInputs()

const GITHUB_APP_URL = 'https://github.com/apps/dependabot-merge-action'

async function run() {
  try {
    const { pull_request: pr } = github.context.payload

    if (!pr) {
      return logError(
        'This action must be used in the context of a Pull Request'
      )
    }

    const pullRequestNumber = pr.number

    const isDependabotPR = pr.user.login === 'dependabot[bot]'

    if (!isDependabotPR) {
      return logWarning('Not a dependabot PR, skipping.')
    }

    const isTargetMatchToPR = checkTargetMatchToPR(pr.title,TARGET)
    if (!isTargetMatchToPR) {
      return logWarning('Target specified does not match to PR, skipping.')
    }
    // dependabot branch names are in format "dependabot/npm_and_yarn/pkg-0.0.1"
    const pkgName = pr.head.ref.split('/').pop().split('-').shift()

    if (EXCLUDE_PKGS.includes(pkgName)) {
      return logInfo(`${pkgName} is excluded, skipping.`)
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        authorization: `token ${GITHUB_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        pullRequestNumber,
        approveOnly: APPROVE_ONLY,
        excludePackages: EXCLUDE_PKGS,
        approveComment: MERGE_COMMENT,
        mergeMethod: MERGE_METHOD,
      }),
    })

    const responseText = await response.text()

    if (response.status === 400) {
      logWarning(`Please ensure that Github App is installed ${GITHUB_APP_URL}`)
    }

    if (!response.ok) {
      throw new Error(
        `Request failed with status code ${response.status}: ${responseText}`
      )
    }

    logInfo(responseText)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
