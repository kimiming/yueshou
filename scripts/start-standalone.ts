import "dotenv/config";
import { spawn } from "node:child_process";

const child = spawn(process.execPath, [".next/standalone/server.js"], { stdio: "inherit", env: { ...process.env, NODE_ENV: "production", PORT: process.env.PORT || "3000", HOSTNAME: "localhost" } });
child.on("exit", (code) => process.exit(code ?? 1));
