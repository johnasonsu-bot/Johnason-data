const { pool } = require("../config/database");
const modelProfileManager = require("../modules/data-lab/data-lab.model-profile-manager");

async function main() {
  const result = await modelProfileManager.ensureDefaultCommitteeProfiles({
    strict: true,
    syncIncubations: true,
  });
  const roles = Array.from(result.profilesByRole.entries()).map(([stageType, profile]) => ({
    stageType,
    profileId: profile.id,
    profileName: profile.profileName,
    providerId: profile.providerId,
    providerName: profile.providerName,
    modelCode: profile.modelCode,
  }));
  console.log(JSON.stringify({
    provider: result.provider,
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
    syncResult: result.syncResult,
    roles,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("[seed-lab-model-profiles] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
