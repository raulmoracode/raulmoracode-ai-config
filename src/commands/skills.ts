import { fetchCatalog, fetchCatalogVersion } from "../catalog/client.js";
import type { Command } from "../cli/command.js";
import { readCachedSkills, skillsCacheDir } from "../opencode/cache.js";
import { parseConfigText, skillsFromConfig } from "../opencode/config-file.js";
import { configScopeLabel, formatList, parseOptions, readTargetConfig } from "./shared.js";

export const skillsCommand: Command = {
  name: "skills",
  summary: "List available, configured, and cached skills",
  async run(argv, context) {
    const options = parseOptions(argv, { global: true, json: true, version: true });
    const target = await readTargetConfig(context, options.global);
    const fetchOptions =
      context.writers.runtime?.fetchImpl === undefined
        ? {}
        : { fetchImpl: context.writers.runtime.fetchImpl };
    const catalog = await fetchCatalog(options.url, fetchOptions);
    const catalogVersion = await fetchCatalogVersion(options.url, fetchOptions);
    const available = catalog.skills.filter(
      (skill) => options.version === undefined || skill.version === options.version,
    );
    const configured = target.exists
      ? parseConfigText(target.text)
      : { ok: true as const, value: {} };
    const config = configured.ok ? skillsFromConfig(configured.value) : undefined;
    const cached = await readCachedSkills(skillsCacheDir(target.environment, options.url));
    const result = {
      catalog: options.url,
      catalogVersion: catalogVersion.version,
      available: available.map((skill) =>
        skill.version === undefined
          ? { name: skill.name }
          : { name: skill.name, version: skill.version },
      ),
      configured: config?.urls.includes(options.url) ? config.urls : (config?.urls ?? []),
      configuredPaths: config?.paths ?? [],
      cached,
      configPath: target.path,
    };
    if (options.json) {
      context.writers.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }
    context.ui.note(
      "Skills",
      [
        `Catalog: ${options.url}`,
        `Config: ${configScopeLabel(options.global)} (${target.path})`,
        "",
        `Available (${available.length}):`,
        formatList(
          available.map((skill) =>
            skill.version ? `${skill.name} (${skill.version})` : skill.name,
          ),
        ),
        "",
        `Configured URLs:`,
        formatList(result.configured),
        "",
        `Configured paths:`,
        formatList(result.configuredPaths),
        "",
        `Cached (${cached.length}):`,
        formatList(
          cached.map((skill) => (skill.version ? `${skill.name} (${skill.version})` : skill.name)),
        ),
      ].join("\n"),
    );
    return 0;
  },
};
