#!/usr/bin/env node

import process from "process";

process.kill(process.pid, "SIGKILL");
