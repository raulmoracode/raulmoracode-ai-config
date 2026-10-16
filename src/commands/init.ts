import type { Command } from "../cli/command.js";
import { applySkillsUrl, readConfigFile, writeConfigFile } from "../opencode/config-file.js";
import { configTarget, ensureParentDirectory, parseOptions } from "./shared.js";

export const initCommand: Command = {
  name: "init",
  summary: "Configure OpenCode to use the remote skills catalog",
  async run(argv, context) {
    const options = parseOptions(argv, { global: true });
    const target = await configTarget(context, options.global);
    const existing = await readConfigFile(target.path);
    const text = existing.exists ? existing.text : "{}\n";
    const result = applySkillsUrl(text, options.url);
    if (!result.ok) {
      context.ui.error(result.error);
      return 1;
    }
    if (result.changed || !existing.exists) {
      await ensureParentDirectory(target.path);
      await writeConfigFile(target.path, result.text);
    }
    context.ui.success(
      result.changed
        ? `Configured ${target.path} with ${options.url}`
        : `${target.path} already uses ${options.url}`,
    );
    return 0;
  },
};
