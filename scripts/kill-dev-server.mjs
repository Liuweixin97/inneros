import { execFileSync } from "node:child_process";

const PORT = process.env.PORT || "3000";

function getListeningPids(port) {
  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return output
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const pids = getListeningPids(PORT).filter((pid) => pid !== String(process.pid));

if (pids.length === 0) {
  process.exit(0);
}

for (const pid of pids) {
  try {
    process.kill(Number(pid), "SIGTERM");
  } catch {
    // The process may already have exited between lsof and kill.
  }
}

setTimeout(() => {
  for (const pid of pids) {
    try {
      process.kill(Number(pid), 0);
      process.kill(Number(pid), "SIGKILL");
    } catch {
      // Already gone.
    }
  }

  console.log(`Cleared stale dev server on port ${PORT}: ${pids.join(", ")}`);
}, 350);
