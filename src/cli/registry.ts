import { doctorCommand } from "../commands/doctor.js";
import { initCommand } from "../commands/init.js";
import { skillsCommand } from "../commands/skills.js";
import type { Command } from "./command.js";

/**
 * All commands exposed by the CLI. Command modules are appended here as they
 * are implemented; the help text and the dispatcher derive from this list.
 */
export const commands: readonly Command[] = [initCommand, skillsCommand, doctorCommand];
