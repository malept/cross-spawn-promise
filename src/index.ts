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
   * @param error - The error thrown from the `spawn` function
   * @param hasLogger - Whether `logger` was set
   */
  updateErrorCallback?: (error: Error, hasLogger: boolean) => void;

  /**
   * Return stderr instead of stdout. Useful for capturing the output of `java -version`
   * as an example.
   */
  returnStderr?: boolean;

  /**
   * Formats stdout and stderr during normal promise resolution.
   */
  formatOutputCallback?: (stdout: string, stderr: string) => string;

  /**
   * Formats the command and arguments for the logger. Useful for hiding secrets,
   * adding quotes around args, vertical space, or any other special needs.
   */
  stringifyCommandCallback?: (
    cmd: string,
    args?: ReadonlyArray<string>
  ) => string;
};

function stringifyCommand(cmd: string, args?: ReadonlyArray<string>): string {
  if (args && Array.isArray(args) && args.length > 0) {
    return `${cmd} ${args.join(" ")}`;
  } else {
    return cmd;
  }
}

function getStringifyCommandCallback(options: CrossSpawnOptions = {}) {
  return options.stringifyCommandCallback
    ? options.stringifyCommandCallback
    : stringifyCommand;
}

function applyStringifyCommandCallback(
  options: CrossSpawnOptions,
  cmd: string,
  args: CrossSpawnArgs
) {
  const cb = getStringifyCommandCallback(options);
  return cb.apply(null, [cmd, args]);
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
    stderr: string,
    options: CrossSpawnOptions = {}
  ) {
    const fullCommand = applyStringifyCommandCallback(options, cmd, args);
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
  public options: CrossSpawnOptions;

  constructor(
    cmd: string,
    args: CrossSpawnArgs,
    message: string,
    stdout: string,
    stderr: string,
    options: CrossSpawnOptions = {}
  ) {
    super(message);
    this.cmd = cmd;
    this.args = args;
    this.stdout = stdout;
    this.stderr = stderr;
    this.options = options;
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
    stderr: string,
    options: CrossSpawnOptions = {}
  ) {
    const fullCommand = applyStringifyCommandCallback(options, cmd, args);
    super(
      cmd,
      args,
      `Command failed with a non-zero return code (${code}):\n${fullCommand}\n${stdout}\n${stderr}`.trim(),
      stdout,
      stderr,
      options
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
    stderr: string,
    options: CrossSpawnOptions = {}
  ) {
    const fullCommand = applyStringifyCommandCallback(options, cmd, args);
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

// eslint-disable-next-line
function renderErr(out: string, err: string) {
  return err;
}

function renderOut(out: string) {
  return out;
}

function render(
  options: CrossSpawnOptions | undefined,
  out: string,
  err: string
) {
  if (!options) {
    options = {};
  }

  const cb = options.formatOutputCallback
    ? options.formatOutputCallback
    : options.returnStderr
    ? renderErr
    : renderOut;

  return cb.apply(null, [out, err]);
}

/**
 * A wrapper around `cross-spawn`'s `spawn` function which can optionally log the command executed
 * and/or customize the outputs and errors via callbacks.
 *
 * @param cmd - The command to run
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

  if (logger) {
    logger(
      `Executing command ${applyStringifyCommandCallback(options, cmd, args)}`
    );
  }

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const process = crossSpawn(cmd, args, spawnOptions);
    if (process.stdout) {
      process.stdout.setEncoding("utf8").on("data", (data) => {
        stdout += data;
      });
    }
    if (process.stderr) {
      process.stderr.setEncoding("utf8").on(
        "data",
        /* istanbul ignore next */ (data) => {
          stderr += data;
        }
      );
    }
    process.on("close", (code, signal) => {
      if (code === 0) {
        resolve(render(options, stdout, stderr));
      } else if (code === null) {
        // Why: assume signal is not null if code is null
        reject(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          new ExitSignalError(cmd, args, signal!, stdout, stderr, options)
        );
      } else {
        reject(new ExitCodeError(cmd, args, code, stdout, stderr, options));
      }
    });
    process.on("error", (err) => {
      if (updateErrorCallback) {
        updateErrorCallback(err, !!logger);
      }
      reject(new CrossSpawnError(cmd, args, err, stderr, options));
    });
  });
}
