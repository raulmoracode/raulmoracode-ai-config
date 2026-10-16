import { fetchCatalog, fetchCatalogVersion } from "../catalog/client.js";
import type { Command } from "../cli/command.js";
import { readCachedSkills, skillsCacheDir } from "../opencode/cache.js";
import { parseConfigText, skillsFromConfig } from "../opencode/config-file.js";
import { parseOptions, readTargetConfig } from "./shared.js";

export const doctorCommand: Command = {
  name: "doctor",
  summary: "Diagnose the remote skills integration (read-only)",
  async run(argv, context) {
    const options = parseOptions(argv, { global: true, json: true });
    const target = await readTargetConfig(context, options.global);
    const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
    if (!target.exists) {
      checks.push({ name: "config", ok: false, detail: `Missing ${target.path}` });
    } else {
      const parsed = parseConfigText(target.text);
      if (!parsed.ok) {
        checks.push({ name: "config", ok: false, detail: parsed.errors.join("; ") });
      } else {
        const config = skillsFromConfig(parsed.value);
        checks.push({
          name: "config",
          ok: config.form !== "invalid" && config.invalidEntries === 0,
          detail: `${config.urls.length} catalog URL(s), ${config.paths.length} local path(s)`,
        });
      }
    }
    let catalogOk = false;
    try {
      const fetchOptions =
        context.writers.runtime?.fetchImpl === undefined
          ? {}
          : { fetchImpl: context.writers.runtime.fetchImpl };
      const catalog = await fetchCatalog(options.url, fetchOptions);
      catalogOk = true;
      checks.push({
        name: "catalog",
        ok: true,
        detail: `${catalog.skills.length} skill(s) available`,
      });
      const catalogVersion = await fetchCatalogVersion(options.url, fetchOptions);
      checks.push({
        name: "catalog-version",
        ok: true,
        detail: `published catalog version ${catalogVersion.version}`,
      });
    } catch (error) {
      checks.push({
        name: "catalog",
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    const cached = await readCachedSkills(skillsCacheDir(target.environment, options.url));
    checks.push({
      name: "cache",
      ok: true,
      detail: `${cached.length} cached skill(s); no changes made`,
    });
    const result = {
      configPath: target.path,
      catalog: options.url,
      checks,
      ok: checks.every((check) => check.ok) && catalogOk,
    };
    if (options.json) {
      context.writers.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      context.ui.note(
        "Doctor",
        checks
          .map((check) => `${check.ok ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`)
          .join("\n"),
      );
      context.ui.outro(
        result.ok
          ? "OpenCode skills integration looks healthy."
          : "OpenCode skills integration needs attention.",
      );
    }
    return result.ok ? 0 : 1;
  },
};
