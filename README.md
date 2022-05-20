# `@malept/cross-spawn-promise`

> A promisified version of [`cross-spawn`](https://npm.im/cross-spawn) with slightly different behavior & extra options.

[![CI](https://github.com/malept/cross-spawn-promise/workflows/CI/badge.svg)](https://github.com/malept/cross-spawn-promise/actions?query=workflow%3ACI)
[![NPM package](https://img.shields.io/npm/v/@malept/cross-spawn-promise.svg)](https://www.npmjs.com/package/@malept/cross-spawn-promise)
[![codecov](https://codecov.io/gh/malept/cross-spawn-promise/branch/main/graph/badge.svg)](https://codecov.io/gh/malept/cross-spawn-promise)

## Different Behavior

If the spawned process exits with a non-zero code, an `ExitCodeError` is thrown with the original
command, code, `stdout`, and `stderr` as properties.

If the spawned process is terminated by a signal on non-Windows platforms, an `ExitSignalError` is
thrown with the original command, signal name, `stdout`, and `stderr` as properties.

The promise will otherwise resolve with the data that went to `stdout`. `stderr` may be used
instead if given the option `returnStderr`. Further output customization can be done by providing a
`formatOutputCallback`. This can be used to hide secrets, return both output and error, or perform
any other post-processing need.

## Extra Options

- `formatOutputCallback`: a callback to format the data that went to stdout and stderr. The
  promise resolves to the output of this function. Defaults to just the data that went to stdout.
- `logger`: a `Function` such as `console.log` or `debug(name)` to log some information
  about the spawned process.
- `stringifyCommandCallback`: a callback to format the command before it is logged. Can be
  used to suppress secrets, or simply render the command in the preferred style. Also applies
  during Error handling, where the command-line string is rendered for inclusion in the
  Error objects.
- `updateErrorCallback`: a callback which mutates the error before it is re-thrown. Most commonly,
  this is used to augment the error message of `ENOENT` error to provide a more human-friendly
  message as to how to install the missing executable.

## Legal

This module is licensed under the Apache 2.0 license.
