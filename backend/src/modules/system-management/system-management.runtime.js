const fs = require("fs");
const os = require("os");
const net = require("net");
const { promisify } = require("util");
const { execFile, spawn } = require("child_process");

const execFileAsync = promisify(execFile);
const RESOURCE_SAMPLE_INTERVAL_MS = 15000;
const RESOURCE_PERIODS = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000
};

let latestSystemResourceSnapshot = null;
let resourceSamplerStarted = false;
let resourceSamplingPromise = null;
const resourceHistory = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapePowerShell(input) {
  return String(input || "").replace(/'/g, "''");
}

function isLocalHost(host) {
  const normalized = String(host || "").trim().toLowerCase();
  return !normalized || normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

async function runPowerShell(command, timeout = 20000) {
  const { stdout, stderr } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-Command", command],
    {
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 8
    }
  );

  return {
    stdout: String(stdout || "").trim(),
    stderr: String(stderr || "").trim()
  };
}

async function runCommand(filePath, args = [], options = {}) {
  const { stdout, stderr } = await execFileAsync(filePath, args, {
    timeout: options.timeout || 30000,
    cwd: options.cwd,
    windowsHide: true,
    env: {
      ...process.env,
      ...(options.env || {})
    },
    maxBuffer: 1024 * 1024 * 8
  });

  return {
    stdout: String(stdout || "").trim(),
    stderr: String(stderr || "").trim()
  };
}

function spawnDetached(filePath, args = [], options = {}) {
  const child = spawn(filePath, args, {
    cwd: options.cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      ...(options.env || {})
    }
  });

  child.unref();
  return child.pid;
}

async function waitForPort(host, port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const reachable = await checkPortReachable(host, port, 1200);
    if (reachable) {
      return true;
    }
    await sleep(500);
  }

  return false;
}

async function checkPortReachable(host, port, timeoutMs = 1500) {
  if (!host || !port) {
    return false;
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();

    const done = (value) => {
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function checkHttpReady(url, timeoutMs = 3000) {
  if (!url) {
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal
    });

    return response.ok;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function getPortListenerDetails(port) {
  if (!port) {
    return null;
  }

  const command = `
    $listener = Get-NetTCPConnection -State Listen -LocalPort ${Number(port)} -ErrorAction SilentlyContinue | Select-Object -First 1 OwningProcess;
    if (-not $listener) { return }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" |
      Select-Object ProcessId, Name, CommandLine;
    $process | ConvertTo-Json -Compress
  `;

  try {
    const { stdout } = await runPowerShell(command);
    return stdout ? JSON.parse(stdout) : null;
  } catch (error) {
    return null;
  }
}

async function getDockerContainerState(containerName) {
  if (!containerName) {
    return null;
  }

  try {
    const { stdout } = await runCommand("docker", [
      "inspect",
      "--format",
      "{{json .State}}",
      containerName
    ], { timeout: 15000 });

    return stdout ? JSON.parse(stdout) : null;
  } catch (error) {
    return null;
  }
}

async function getComposeServiceState(projectName) {
  if (!projectName) {
    return { running: false, containers: [], hasRunning: false, hasDegraded: false };
  }

  try {
    const { stdout } = await runCommand("docker", [
      "ps",
      "-a",
      "--filter",
      `label=com.docker.compose.project=${projectName}`,
      "--format",
      "{{.Names}}\t{{.State}}\t{{.Status}}"
    ], { timeout: 15000 });

    const containers = stdout
      ? stdout
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => {
            const [name, state, status] = line.split("\t");
            return { name, state, status };
          })
      : [];
    const hasRunning = containers.some((item) => item.state === "running");
    const hasDegraded = containers.some((item) => item.state === "restarting" || item.state === "exited" || item.state === "dead");

    return {
      running: hasRunning,
      containers,
      hasRunning,
      hasDegraded
    };
  } catch (error) {
    return { running: false, containers: [], hasRunning: false, hasDegraded: false };
  }
}

async function readDisks() {
  try {
    const { stdout } = await runPowerShell(
      "Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object DeviceID, VolumeName, Size, FreeSpace | ConvertTo-Json -Compress",
      15000
    );

    if (!stdout) {
      return [];
    }

    const parsed = JSON.parse(stdout);
    const items = Array.isArray(parsed) ? parsed : [parsed];

    return items.map((item) => {
      const size = Number(item.Size || 0);
      const free = Number(item.FreeSpace || 0);
      const used = Math.max(size - free, 0);

      return {
        name: item.DeviceID,
        label: item.VolumeName || item.DeviceID,
        size,
        free,
        used,
        usedPercent: size > 0 ? Number(((used / size) * 100).toFixed(2)) : 0
      };
    });
  } catch (error) {
    return [];
  }
}

function getDiskMaxUsage(disks = []) {
  return disks.reduce((max, disk) => Math.max(max, Number(disk.usedPercent || 0)), 0);
}

function normalizeResourcePeriod(period) {
  return Object.prototype.hasOwnProperty.call(RESOURCE_PERIODS, period) ? period : "1h";
}

function pruneResourceHistory(now = Date.now()) {
  const cutoff = now - RESOURCE_PERIODS["24h"];

  while (resourceHistory.length > 0) {
    const sampleTime = Date.parse(resourceHistory[0].timestamp);
    if (!Number.isNaN(sampleTime) && sampleTime >= cutoff) {
      break;
    }

    resourceHistory.shift();
  }
}

async function sampleCpuUsage() {
  const first = os.cpus();
  await sleep(200);
  const second = os.cpus();

  let idle = 0;
  let total = 0;

  for (let index = 0; index < first.length; index += 1) {
    const firstTimes = first[index].times;
    const secondTimes = second[index].times;
    const idleDiff = secondTimes.idle - firstTimes.idle;
    const totalDiff = Object.keys(firstTimes).reduce(
      (sum, key) => sum + (secondTimes[key] - firstTimes[key]),
      0
    );

    idle += idleDiff;
    total += totalDiff;
  }

  if (!total) {
    return 0;
  }

  return Number((((total - idle) / total) * 100).toFixed(2));
}

async function collectBaseSystemResources() {
  const cpuUsage = await sampleCpuUsage();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const disks = await readDisks();
  const sampledAt = new Date().toISOString();

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptimeSeconds: os.uptime(),
    cpuUsage,
    totalMemory,
    freeMemory,
    usedMemory: totalMemory - freeMemory,
    memoryUsage: totalMemory > 0 ? Number((((totalMemory - freeMemory) / totalMemory) * 100).toFixed(2)) : 0,
    disks,
    managedProcesses: [],
    sampledAt
  };
}

async function collectResourceSample(force = false) {
  if (resourceSamplingPromise && !force) {
    return resourceSamplingPromise;
  }

  resourceSamplingPromise = (async () => {
    const snapshot = await collectBaseSystemResources();
    latestSystemResourceSnapshot = snapshot;
    resourceHistory.push({
      timestamp: snapshot.sampledAt,
      cpuUsage: snapshot.cpuUsage,
      memoryUsage: snapshot.memoryUsage,
      usedMemory: snapshot.usedMemory,
      totalMemory: snapshot.totalMemory,
      diskMaxUsage: getDiskMaxUsage(snapshot.disks)
    });
    pruneResourceHistory(Date.parse(snapshot.sampledAt));
    return snapshot;
  })();

  try {
    return await resourceSamplingPromise;
  } finally {
    resourceSamplingPromise = null;
  }
}

function ensureResourceSamplerStarted() {
  if (resourceSamplerStarted) {
    return;
  }

  resourceSamplerStarted = true;
  void collectResourceSample(true).catch(() => {});

  const timer = setInterval(() => {
    void collectResourceSample(true).catch(() => {});
  }, RESOURCE_SAMPLE_INTERVAL_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

async function getResourceSnapshot(period = "1h") {
  ensureResourceSamplerStarted();

  const normalizedPeriod = normalizeResourcePeriod(period);
  const latestTimestamp = latestSystemResourceSnapshot?.sampledAt ? Date.parse(latestSystemResourceSnapshot.sampledAt) : NaN;
  const needsRefresh = !latestSystemResourceSnapshot
    || Number.isNaN(latestTimestamp)
    || (Date.now() - latestTimestamp) > RESOURCE_SAMPLE_INTERVAL_MS * 2;
  const snapshot = needsRefresh ? await collectResourceSample() : latestSystemResourceSnapshot;
  const cutoff = Date.now() - RESOURCE_PERIODS[normalizedPeriod];
  const history = resourceHistory.filter((item) => {
    const sampleTime = Date.parse(item.timestamp);
    return !Number.isNaN(sampleTime) && sampleTime >= cutoff;
  });

  return {
    ...snapshot,
    history,
    historyPeriod: normalizedPeriod,
    sampleIntervalSeconds: Math.round(RESOURCE_SAMPLE_INTERVAL_MS / 1000),
    collectedSamples: resourceHistory.length
  };
}

function cleanupPidFiles(config) {
  for (const filePath of config.pidFiles || []) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
    }
  }
}

async function stopNodeProcessesByPatterns(patterns = []) {
  const filters = patterns
    .filter(Boolean)
    .map((item) => `$_.CommandLine -match '${escapePowerShell(item)}'`)
    .join(" -or ");

  if (!filters) {
    return;
  }

  const command = `
    $targets = Get-CimInstance Win32_Process |
      Where-Object {
        $_.Name -eq 'node.exe' -and $_.CommandLine -and (${filters})
      };
    foreach ($target in $targets) {
      Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue;
    }
  `;

  await runPowerShell(command, 20000);
}

async function stopProcessByExecutablePath(executablePath) {
  if (!executablePath) {
    return;
  }

  const command = `
    $targets = Get-CimInstance Win32_Process |
      Where-Object {
        $_.ExecutablePath -eq '${escapePowerShell(executablePath)}'
      };
    foreach ($target in $targets) {
      Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue;
    }
  `;

  await runPowerShell(command, 20000);
}

async function stopProcessByPort(port) {
  if (!port) {
    return;
  }

  const command = `
    $targets = Get-NetTCPConnection -LocalPort ${Number(port)} -ErrorAction SilentlyContinue |
      Where-Object { $_.State -eq 'Listen' } |
      Select-Object -ExpandProperty OwningProcess -Unique;
    foreach ($target in $targets) {
      Stop-Process -Id $target -Force -ErrorAction SilentlyContinue;
    }
  `;

  await runPowerShell(command, 20000);
}

async function stopProcessById(processId) {
  if (!processId) {
    return;
  }

  await runPowerShell(`Stop-Process -Id ${Number(processId)} -Force -ErrorAction SilentlyContinue`, 10000);
}

async function getServiceRuntime(service) {
  const host = service.host || "127.0.0.1";
  const reachable = service.port ? await checkPortReachable(host, Number(service.port)) : false;
  const ready = service.config?.readyUrl ? await checkHttpReady(service.config.readyUrl) : reachable;
  const localPortInfo = service.port && isLocalHost(host) ? await getPortListenerDetails(Number(service.port)) : null;

  let runtime = {
    state: ready ? "running" : reachable ? "degraded" : "stopped",
    reachable,
    ready,
    host,
    port: service.port || null,
    pid: localPortInfo?.ProcessId || null,
    processName: localPortInfo?.Name || null,
    commandLine: localPortInfo?.CommandLine || null,
    readyUrl: service.config?.readyUrl || null
  };

  if (service.manageMode === "docker") {
    const state = await getDockerContainerState(service.config?.containerName);
    const containerActive = Boolean(state?.Running || state?.Status === "restarting");
    const healthStatus = state?.Health?.Status || null;
    const containerReady = ready
      || healthStatus === "healthy"
      || (Boolean(state?.Running) && !healthStatus && !service.config?.readyUrl);
    runtime = {
      ...runtime,
      state: containerReady ? "running" : containerActive ? "degraded" : "stopped",
      reachable: reachable || Boolean(state?.Running),
      ready: containerReady,
      containerName: service.config?.containerName || null,
      containerStatus: state?.Status || null,
      healthStatus
    };
  }

  if (service.manageMode === "docker_compose") {
    const composeState = await getComposeServiceState(service.config?.projectName);
    runtime = {
      ...runtime,
      state: ready ? "running" : (composeState.hasRunning || composeState.hasDegraded) ? "degraded" : "stopped",
      reachable: reachable || composeState.hasRunning,
      ready,
      containers: composeState.containers.map((item) => item.name),
      containerDetails: composeState.containers,
      projectName: service.config?.projectName || null
    };
  }

  return runtime;
}

async function startLocalProcess(service) {
  cleanupPidFiles(service.config || {});

  const executablePath = service.config?.executablePath;
  const workingDirectory = service.config?.workingDirectory;
  const args = Array.isArray(service.config?.args) ? service.config.args.map((item) => String(item)) : [];

  if (!executablePath) {
    throw new Error(`服务 ${service.serviceName} 缺少 executablePath 配置`);
  }

  spawnDetached(executablePath, args, {
    cwd: workingDirectory,
    env: service.config?.env || {}
  });

  if (service.port && isLocalHost(service.host)) {
    await waitForPort(service.host || "127.0.0.1", Number(service.port), 30000);
  }
}

async function startDockerService(service) {
  const containerName = service.config?.containerName;
  const image = service.config?.image;
  const runArgs = Array.isArray(service.config?.runArgs) ? service.config.runArgs : [];

  const state = await getDockerContainerState(containerName);
  if (state) {
    await runCommand("docker", ["start", containerName], { timeout: 60000 });
  } else {
    await runCommand("docker", ["run", "-d", "--name", containerName, ...runArgs, image], { timeout: 120000 });
  }

  if (service.port && isLocalHost(service.host)) {
    await waitForPort(service.host || "127.0.0.1", Number(service.port), 120000);
  }
}

async function startComposeService(service) {
  await runCommand(
    "docker",
    ["compose", "-p", service.config?.projectName, "up", "-d"],
    {
      cwd: service.config?.workingDirectory,
      timeout: 120000,
      env: {
        DEBUG: "false",
        FLASK_DEBUG: "false"
      }
    }
  );

  if (service.port && isLocalHost(service.host)) {
    await waitForPort(service.host || "127.0.0.1", Number(service.port), 180000);
  }
}

async function stopLocalProcess(service, options = {}) {
  if (options.processId) {
    await stopProcessById(options.processId);
    return;
  }

  const patterns = service.config?.commandLinePatterns || [];

  if (service.serviceType === "backend" || service.serviceType === "frontend") {
    await stopNodeProcessesByPatterns(patterns);
    return;
  }

  if (service.serviceType === "mysql") {
    await stopProcessByExecutablePath(service.config?.executablePath);
    return;
  }

  if (service.port && isLocalHost(service.host)) {
    await stopProcessByPort(Number(service.port));
  }
}

async function stopDockerService(service) {
  const containerName = service.config?.containerName;
  if (!containerName) {
    return;
  }

  const state = await getDockerContainerState(containerName);
  if (!state) {
    return;
  }

  await runCommand("docker", ["stop", containerName], { timeout: 60000 });
}

async function stopComposeService(service) {
  await runCommand(
    "docker",
    ["compose", "-p", service.config?.projectName, "stop"],
    {
      cwd: service.config?.workingDirectory,
      timeout: 120000,
      env: {
        DEBUG: "false",
        FLASK_DEBUG: "false"
      }
    }
  );
}

async function runCustomServiceCommand(service, action) {
  const commandMap = {
    start: service.config?.startCommand,
    stop: service.config?.stopCommand,
    restart: service.config?.restartCommand
  };

  const command = commandMap[action];
  if (!command) {
    throw new Error(`服务 ${service.serviceName} 未配置 ${action}Command`);
  }

  await runPowerShell(command, 120000);
}

async function startManagedService(service) {
  if (service.manageMode === "process") {
    return startLocalProcess(service);
  }

  if (service.manageMode === "docker") {
    return startDockerService(service);
  }

  if (service.manageMode === "docker_compose") {
    return startComposeService(service);
  }

  return runCustomServiceCommand(service, "start");
}

async function stopManagedService(service, options = {}) {
  if (service.manageMode === "process") {
    return stopLocalProcess(service, options);
  }

  if (service.manageMode === "docker") {
    return stopDockerService(service);
  }

  if (service.manageMode === "docker_compose") {
    return stopComposeService(service);
  }

  return runCustomServiceCommand(service, "stop");
}

async function restartManagedService(service, options = {}) {
  await stopManagedService(service, options);
  await sleep(1000);
  await startManagedService(service);
}

async function readSystemResources(managedServices = []) {
  const snapshot = await getResourceSnapshot();
  const managedProcesses = managedServices
    .filter((item) => item.runtime?.pid)
    .map((item) => ({
      serviceKey: item.serviceKey,
      serviceName: item.serviceName,
      pid: item.runtime.pid,
      port: item.runtime.port || null,
      processName: item.runtime.processName || null
    }));

  return {
    ...snapshot,
    managedProcesses
  };
}

module.exports = {
  sleep,
  isLocalHost,
  spawnDetached,
  waitForPort,
  checkPortReachable,
  checkHttpReady,
  getDockerContainerState,
  getServiceRuntime,
  getResourceSnapshot,
  startManagedService,
  stopManagedService,
  restartManagedService,
  readSystemResources
};
