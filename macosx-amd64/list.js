
var soljsonSources = [
  "solc-macosx-amd64-v0.6.11+commit.5ef660b1",
  "solc-macosx-amd64-v0.6.10+commit.00c0fcaf",
  "solc-macosx-amd64-v0.6.9+commit.3e3065ac"
];
var soljsonReleases = {
  "0.6.11": "solc-macosx-amd64-v0.6.11+commit.5ef660b1",
  "0.6.10": "solc-macosx-amd64-v0.6.10+commit.00c0fcaf",
  "0.6.9": "solc-macosx-amd64-v0.6.9+commit.3e3065ac"
};

if (typeof(module) !== 'undefined')
  module.exports = {
    'allVersions': soljsonSources,
    'releases': soljsonReleases
  };
