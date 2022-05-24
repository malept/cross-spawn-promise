import { CrossSpawnError, ExitSignalError, spawn } from "../src";
import path from "path";
// eslint-disable-next-line import/no-unresolved
import test from "ava";

test("returns stdout", async (t) => {
  const dir = process.platform === "darwin" ? "ls" : "dir";
  const output = await spawn(dir, [__dirname], { logger: () => null });
  t.regex(output, /index\.ts/);
});

// Originally from https://github.com/electron/windows-installer/pull/409#issuecomment-1071317903
test("does not split UTF-8 characters across chunks", async (t) => {
  const output = await spawn("node", [
    "-e",
    "process.stdout.write(Buffer.from([0xe5, 0xa5])); setTimeout(() => process.stdout.write(Buffer.from([0xbd])), 100)",
  ]);
  t.is(output, "好");
});

test("returns empty string if stdio is ignored", async (t) => {
  const dir = process.platform === "darwin" ? "ls" : "dir";
  const output = await spawn(dir, [__dirname], { stdio: "ignore" });
  t.is(output, "");
});

test("throws an error when it cannot find an executable", async (t) => {
  const error = (await t.throwsAsync(spawn("does-not-exist"), {
    instanceOf: CrossSpawnError,
    message: /^Error executing command/,
  })) as CrossSpawnError;

  const originalError = error.originalError as NodeJS.ErrnoException;

  t.is(originalError.code, "ENOENT");
  t.is(originalError.syscall, "spawn does-not-exist");
});

if (process.platform !== "win32") {
  test("throws an error when the spawned process is terminated via a signal", async (t) => {
    const error = (await t.throwsAsync(
      spawn(path.resolve(__dirname, "..", "node_modules", ".bin", "ts-node"), [
        path.resolve(__dirname, "fixtures", "killed-by-signal.ts"),
      ]),
      {
        instanceOf: ExitSignalError,
        message: /^Command terminated via a signal/,
      }
    )) as ExitSignalError;

    t.is(error.signal, "SIGKILL");
  });
}

test("updateErrorCallback modifies the exception", async (t) => {
  await t.throwsAsync(
    spawn("does-not-exist", [], {
      updateErrorCallback: (err) => {
        err.message = "I am an error";
      },
    }),
    { message: /I am an error/ }
  );
});

type ErrorWithOptionalMessage = {
  message?: string;
};

test("updateErrorCallback removes the message from the error", async (t) => {
  await t.throwsAsync(
    spawn("does-not-exist", [], {
      updateErrorCallback: (err: ErrorWithOptionalMessage) => {
        delete err.message;
      },
    }),
    { message: /^Error executing command \(does-not-exist\):\nError/ }
  );
});

test("can return the stderr", async (t) => {
  const testStr = "I went there";
  const output = await spawn("node", ["-e", `console.error("${testStr}")`], {
    returnStderr: true,
  });
  t.is(output.trim(), testStr);
});

test("respects the formatOutputCallback", async (t) => {
  const testStr = "authToken=Tm9zeSBsaXR0bGUgZGV2LCBhcmVuJ3QgeW91PyE=";
  const output = await spawn("node", ["-e", `console.log("${testStr}")`], {
    returnStderr: true,
    formatOutputCallback: redact,
  });
  t.is(output.trim(), "authToken=REDACTED");
});

test("custom log formatter does not break anything", async (t) => {
  const testStr = "authToken=SSBzYXcgdGhhdA==";
  const output = await spawn("node", ["-e", `console.log("${testStr}")`], {
    returnStderr: true,
    logger: console.log,
    stringifyCommandCallback: (cmd: string, args?: ReadonlyArray<string>) => {
      let logThese: string[] = [];
      if (args && Array.isArray(args)) {
        logThese = args.map((arg) => redact(arg));
      }
      return JSON.stringify([cmd, ...logThese], null, 2);
    },
    formatOutputCallback: redact,
  });
  t.is(output.trim(), "authToken=REDACTED");
});

function redact(input: string): string {
  return input?.replace(/authToken=[^\s]*/, "authToken=REDACTED");
}
