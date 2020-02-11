# `@malept/cross-spawn-promise`

> A promisified version of `cross-spawn` with slightly different behavior & extra options.

## Different Behavior

If the spawned process exits with a non-zero code, an `ExitCodeError` is thrown with the original
command, code, `stdout`, and `stderr` as properties.

## Extra Options

* `logger`: a `Function` such as `console.log` or `debug(name)` to log some information
  about the spawned process.
* `updateErrorCallback`: a callback which mutates the error before it is re-thrown. Most commonly,
  this is used to augment the error message of `ENOENT` error to provide a more human-friendly
  message as to how to install the missing executable.

## Legal

This module is licensed under the Apache 2.0 license.
