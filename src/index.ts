import crossSpawn from "cross-spawn";
import { SpawnOptions } from "child_process";

export type LoggerFunction = (message: string) => void;

/**
 * List of string arguments.
 */
export type CrossSpawnArgs = ReadonlyArray<string> | undefined;

export type CrossSpawnOptions = SpawnOptions & {
  /**
   * A `Function` such as `console.log` or `debug(name)` to log some information about the
   * spawned process.
   */
  logger?: LoggerFunction;

  /**
   * A callback which mutates the error before it is rethrown. Most commonly, this is used to
   * augment the error message of `ENOENT` errors to provide a more human-friendly message as to
   * how to install the missing executable.
   *
   * @param error the error thrown from the `spawn` function
   * @param hasLogger whether `logger` was set
   */
  updateErrorCallback?: (error: Error, hasLogger: boolean) => void;
};

function stringifyCommand(cmd: string, args?: ReadonlyArray<string>): string {
  if (args && Array.isArray(args) && args.length > 0) {
    return `${cmd} ${args.join(" ")}`;
  } else {
    return cmd;
  }
}

/**
 * Wrapper error for when the spawn function itself emits an error.
 */
export class CrossSpawnError extends Error {
  public originalError: Error;

  constructor(
    cmd: string,
    args: CrossSpawnArgs,
    originalError: Error,
    stderr: string
  ) {
    const fullCommand = stringifyCommand(cmd, args);
    const errorMessage = originalError.message || originalError;
    super(
      `Error executing command (${fullCommand}):\n${errorMessage}\n${stderr}`.trim()
    );
    this.originalError = originalError;
  }
}

/**
 * Base error class for when a process does not exit with a status code of zero.
 */
export abstract class ExitError extends Error {
  public cmd: string;
  public args: CrossSpawnArgs;
  public stdout: string;
  public stderr: string;

  constructor(
    cmd: string,
    args: CrossSpawnArgs,
    message: string,
    stdout: string,
    stderr: string
  ) {
    super(message);
    this.cmd = cmd;
    this.args = args;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

/**
 * The error thrown when a process emits a non-zero exit code.
 */
export class ExitCodeError extends ExitError {
  public code: number;

  constructor(
    cmd: string,
    args: CrossSpawnArgs,
    code: number,
    stdout: string,
    stderr: string
  ) {
    const fullCommand = stringifyCommand(cmd, args);
    super(
      cmd,
      args,
      `Command failed with a non-zero return code (${code}):\n${fullCommand}\n${stdout}\n${stderr}`.trim(),
      stdout,
      stderr
    );
    this.code = code;
  }
}

/**
 * The error thrown when a process exits via a signal.
 */
export class ExitSignalError extends ExitError {
  public signal: string;

  constructor(
    cmd: string,
    args: CrossSpawnArgs,
    signal: string,
    stdout: string,
    stderr: string
  ) {
    const fullCommand = stringifyCommand(cmd, args);
    super(
      cmd,
      args,
      `Command terminated via a signal (${signal}):\n${fullCommand}\n${stdout}\n${stderr}`.trim(),
      stdout,
      stderr
    );
    this.signal = signal;
  }
}

/**
 * A wrapper around `cross-spawn`'s `spawn` function which can optionally log the command executed
 * and/or change the error object via a callback.
 *
 * @param cmd The command to run
 */
export async function spawn(
  cmd: string,
  args?: CrossSpawnArgs,
  options?: CrossSpawnOptions
): Promise<string> {
  if (!options) {
    options = {} as CrossSpawnOptions;
  }
  const { logger, updateErrorCallback, ...spawnOptions } = options;
  if (logger) logger(`Executing command ${stringifyCommand(cmd, args)}`);

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const process = crossSpawn(cmd, args, spawnOptions);
    if (process.stdout) {
      process.stdout.on("data", (data) => {
        stdout += data.toString();
      });
    }
    if (process.stderr) {
      process.stderr.on(
        "data",
        /* istanbul ignore next */ (data) => {
          stderr += data.toString();
        }
      );
    }
    process.on("close", (code, signal) => {
      if (code === 0) {
        resolve(stdout);
      } else if (code === null) {
        reject(new ExitSignalError(cmd, args, signal, stdout, stderr));
      } else {
        reject(new ExitCodeError(cmd, args, code, stdout, stderr));
      }
    });
    process.on("error", (err) => {
      if (updateErrorCallback) {
        updateErrorCallback(err, !!logger);
      }
      reject(new CrossSpawnError(cmd, args, err, stderr));
    });
  });
}
