# solc-bin

This repository contains current and historical builds of the [Solidity Compiler](https://github.com/ethereum/solidity/).

Please refer to the section on [Static Binaries](https://docs.soliditylang.org/en/latest/installing-solidity.html#static-binaries)
in the official documentation for information about the structure of this repository, its content and recommended usage.

## Deprecation notice for the `ethereum.github.io` domain

**The content of this repository is mirrored at https://binaries.soliditylang.org. This is the recommended way to fetch compiler binaries over HTTPS.**

The binaries are also available at https://ethereum.github.io/solc-bin/ but this page
stopped being updated just after the release of version 0.7.2, will not receive any new releases
or nightly builds for any platform and does not serve the new directory structure, including
non-emscripten builds.

If you are using it, please switch to https://binaries.soliditylang.org, which is a drop-in
replacement. This allows us to make changes to the underlying hosting in a transparent way and
minimize disruption. Unlike the `ethereum.github.io` domain, which we do not have any control
over, `binaries.soliditylang.org` is guaranteed to work and maintain the same URL structure
in the long-term.
