import { existsSync } from "fs";
import os from "os";
import { spawn, spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PYTHON_DIR = path.resolve(__dirname, "../../python");
const PYTHON_PROBE_ENV = {
  ...process.env,
  MPLCONFIGDIR: process.env.MPLCONFIGDIR || "/tmp",
  XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || "/tmp"
};

let resolvedPythonBin;

function buildPythonCandidates() {
  const candidates = [
    process.env.PYTHON_BIN,
    process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, "bin/python") : null,
    path.join(os.homedir(), "anaconda3/bin/python"),
    path.join(os.homedir(), "miniconda3/bin/python"),
    "python3",
    "python"
  ];

  return [...new Set(candidates.filter(Boolean))];
}

function canRunProphet(pythonBin) {
  if (pythonBin.includes("/") && !existsSync(pythonBin)) return false;

  const probe = spawnSync(
    pythonBin,
    ["-c", "import prophet, sys; print(sys.executable)"],
    {
      env: PYTHON_PROBE_ENV,
      encoding: "utf8"
    }
  );

  return probe.status === 0;
}

function resolvePythonBin() {
  if (resolvedPythonBin) return resolvedPythonBin;

  for (const candidate of buildPythonCandidates()) {
    if (canRunProphet(candidate)) {
      resolvedPythonBin = candidate;
      return resolvedPythonBin;
    }
  }

  resolvedPythonBin = process.env.PYTHON_BIN || "python3";
  return resolvedPythonBin;
}

export function getPythonScriptPath(fileName) {
  return path.join(PYTHON_DIR, fileName);
}

export async function runPythonJson(scriptName, payload) {
  const scriptPath = getPythonScriptPath(scriptName);
  const pythonBin = resolvePythonBin();
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: PYTHON_PROBE_ENV
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const message = stderr || stdout || `Python worker failed with code ${code}`;
        reject(new Error(message));
        return;
      }
      try {
        resolve(stdout ? JSON.parse(stdout) : {});
      } catch (err) {
        reject(new Error(`Invalid Python JSON output: ${err.message}`));
      }
    });

    child.stdin.write(JSON.stringify(payload || {}));
    child.stdin.end();
  });
}
