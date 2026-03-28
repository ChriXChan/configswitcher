#!/usr/bin/env node
import path from "node:path";

import { ConfigSwitcherApp } from "./ui/app";

function normalizeBasenameArguments(args: string[]): string[] {
  return args
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => item !== "System.Object[]");
}

function parseArguments(): { initialDirectory: string; initialBasenames: string[] } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return {
      initialDirectory: process.cwd(),
      initialBasenames: [],
    };
  }

  const firstArg = args[0];
  const treatFirstArgAsDirectory =
    firstArg.includes("\\") || firstArg.includes("/") || firstArg === ".";

  if (treatFirstArgAsDirectory) {
    return {
      initialDirectory: path.resolve(firstArg),
      initialBasenames: normalizeBasenameArguments(args.slice(1)),
    };
  }

  return {
    initialDirectory: process.cwd(),
    initialBasenames: normalizeBasenameArguments(args),
  };
}

async function main(): Promise<void> {
  const app = new ConfigSwitcherApp(parseArguments());
  await app.start();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`启动失败：${message}`);
  process.exit(1);
});
