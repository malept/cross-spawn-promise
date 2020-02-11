import { spawn } from "../src";
import test from "ava";

test("returns stdout", async t => {
  const dir = process.platform === "darwin" ? "ls" : "dir";
  const output = await spawn(dir, [__dirname], { logger: () => null });
  t.regex(output, /index\.ts/);
});

test("returns empty string if stdio is ignored", async t => {
  const dir = process.platform === "darwin" ? "ls" : "dir";
  const output = await spawn(dir, [__dirname], { stdio: "ignore" });
  t.is(output, "");
});

test("throws an error when it cannot find an executable", async t => {
  await t.throwsAsync(spawn("does-not-exist"), {
    message: /^Error executing command/
  });
});

test("updateErrorCallback modifies the exception", async t => {
  await t.throwsAsync(
    spawn("does-not-exist", [], {
      updateErrorCallback: err => {
        err.message = "I am an error";
      }
    }),
    { message: /I am an error/ }
  );
});

test("updateErrorCallback removes the message from the error", async t => {
  await t.throwsAsync(
    spawn("does-not-exist", [], {
      updateErrorCallback: err => {
        delete err.message;
      }
    }),
    { message: /^Error executing command \(Error\)/ }
  );
});
