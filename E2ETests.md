# E2E Tests

It appears that some solc compilers fail checksum verification.

Gist [e2e3d153a09c622c259826e80b9704a7](https://gist.github.com/gabrielfalcao/e2e3d153a09c622c259826e80b9704a7) presents self-contained script to "sync" solc compiler versions listed in [https://binaries.soliditylang.org/bin/list.json](https://binaries.soliditylang.org/bin/list.json) and, in a strict sense, reliably verify the checksum each compiler version while logging to sync-compilers.log

> more [here](https://gist.github.com/gabrielfalcao/e2e3d153a09c622c259826e80b9704a7#file-readme-md)
