const runtime = require("../modules/system-management/system-management.runtime");

function parseJson(name) {
  const value = process.env[name];
  return value ? JSON.parse(value) : null;
}

async function main() {
  const action = process.env.ACTION;
  const targetPid = Number(process.env.TARGET_PID || 0) || null;
  const service = parseJson("SERVICE_JSON");
  const backendService = parseJson("BACKEND_SERVICE_JSON");
  const frontendService = parseJson("FRONTEND_SERVICE_JSON");

  await runtime.sleep(1000);

  if (action === "restart-service") {
    await runtime.stopManagedService(service, { processId: targetPid });
    await runtime.sleep(800);
    await runtime.startManagedService(service);
    return;
  }

  if (action === "stop-service") {
    await runtime.stopManagedService(service, { processId: targetPid });
    return;
  }

  if (action === "restart-web-stack") {
    await runtime.stopManagedService(frontendService);
    await runtime.stopManagedService(backendService, { processId: targetPid });
    await runtime.sleep(800);
    await runtime.startManagedService(backendService);
    await runtime.sleep(1200);
    await runtime.startManagedService(frontendService);
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
