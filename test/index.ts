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
