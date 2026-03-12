#!/usr/bin/env node

import { Command } from "commander";
import { registerTeamCommands } from "./commands/team.js";
import { registerMailCommands } from "./commands/mail.js";
import { registerTaskCommands } from "./commands/task.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerSopCommands } from "./commands/sop.js";
import type { Format } from "./utils/output.js";

const program = new Command();

program
  .name("atos")
  .description("Agent teamwork in your terminal")
  .version("0.3.0")
  .option("--dir <path>", ".atos directory location")
  .option("--format <fmt>", "Output format: json | human", "json")
  .option("--agent <name>", "Act as this agent (or set ATOS_AGENT env var)");

const getFormat = (): Format => program.opts().format as Format;
const getDir = (): string | undefined => program.opts().dir;
const getAgentFlag = (): string | undefined => program.opts().agent;

registerTeamCommands(program, getFormat, getDir);
registerMailCommands(program, getFormat, getDir, getAgentFlag);
registerTaskCommands(program, getFormat, getDir, getAgentFlag);
registerConfigCommands(program, getFormat, getDir);
registerSopCommands(program, getFormat, getDir);

program.parse();
