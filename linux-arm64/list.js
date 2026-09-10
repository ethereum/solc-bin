
var soljsonSources = [
  "solc-linux-arm64-v0.8.37+commit.f401782d",
  "solc-linux-arm64-v0.8.36+commit.8a079791",
  "solc-linux-arm64-v0.8.35+commit.47b9dedd",
  "solc-linux-arm64-v0.8.35-pre.1+commit.a99b6d8c",
  "solc-linux-arm64-v0.8.34+commit.80d5c536",
  "solc-linux-arm64-v0.8.33+commit.64118f21",
  "solc-linux-arm64-v0.8.32+commit.ebbd65e5",
  "solc-linux-arm64-v0.8.31+commit.fd3a2265"
];
var soljsonReleases = {
  "0.8.37": "solc-linux-arm64-v0.8.37+commit.f401782d",
  "0.8.36": "solc-linux-arm64-v0.8.36+commit.8a079791",
  "0.8.35": "solc-linux-arm64-v0.8.35+commit.47b9dedd",
  "0.8.34": "solc-linux-arm64-v0.8.34+commit.80d5c536",
  "0.8.33": "solc-linux-arm64-v0.8.33+commit.64118f21",
  "0.8.32": "solc-linux-arm64-v0.8.32+commit.ebbd65e5",
  "0.8.31": "solc-linux-arm64-v0.8.31+commit.fd3a2265"
};

if (typeof(module) !== 'undefined')
  module.exports = {
    'allVersions': soljsonSources,
    'releases': soljsonReleases
  };
