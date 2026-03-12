import { Command } from "commander";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { output, type Format } from "../utils/output.js";

interface SopMeta {
  name: string;
  role: string;
  frequency: string;
  description: string;
}

interface SopStep {
  id: number;
  title: string;
  commands: string[];
  guidance: string;
}

interface SopParsed {
  meta: SopMeta;
  steps: SopStep[];
}

/** Find .atos/sops/ directory by walking up from cwd */
function findSopsDir(dirOverride?: string): string {
  if (dirOverride) {
    return resolve(dirOverride, "sops");
  }
  let dir = resolve(process.cwd());
  while (true) {
    const candidate = resolve(dir, ".atos", "sops");
    try {
      readdirSync(candidate);
      return candidate;
    } catch {
      // not found, go up
    }
    const parent = resolve(dir, "..");
    if (parent === dir) {
      process.stderr.write("Error: No .atos/sops directory found. Run `atos team init` first.\n");
      process.exit(1);
    }
    dir = parent;
  }
}

/** Parse YAML-like frontmatter (simple key: value) */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { meta, body: match[2] };
}

/** Split markdown body into step sections, respecting code block boundaries */
function splitStepSections(body: string): string[] {
  const sections: string[] = [];
  let current = "";
  let inCodeBlock = false;

  for (const line of body.split("\n")) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
    }
    if (!inCodeBlock && /^## Step\s+\d+/.test(line)) {
      if (current.trim()) sections.push(current);
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }
  if (current.trim()) sections.push(current);
  return sections;
}

/** Parse SOP markdown body into structured steps */
function parseSteps(body: string): SopStep[] {
  const sections = splitStepSections(body);
  const steps: SopStep[] = [];

  for (const section of sections) {
    const headerMatch = section.match(/^## Step\s+(\d+)[:\s]+(.+)/);
    if (!headerMatch) continue;

    const id = Number(headerMatch[1]);
    const title = headerMatch[2].trim();

    // Extract all ```bash code blocks
    const commands: string[] = [];
    const codeBlockRe = /```bash\n([\s\S]*?)```/g;
    let m;
    while ((m = codeBlockRe.exec(section)) !== null) {
      for (const line of m[1].split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          commands.push(trimmed);
        }
      }
    }

    // Guidance = everything outside code blocks, cleaned up
    const guidance = section
      .replace(/^## Step\s+\d+[:\s]+.+\n?/, "")
      .replace(/```bash\n[\s\S]*?```/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    steps.push({ id, title, commands, guidance });
  }

  return steps;
}

/** Parse a complete SOP file */
function parseSop(filePath: string): SopParsed {
  const raw = readFileSync(filePath, "utf-8");
  const { meta, body } = parseFrontmatter(raw);
  const steps = parseSteps(body);
  return {
    meta: {
      name: meta.name || basename(filePath, ".md"),
      role: meta.role || "",
      frequency: meta.frequency || "",
      description: meta.description || "",
    },
    steps,
  };
}

export function registerSopCommands(
  program: Command,
  getFormat: () => Format,
  getDir: () => string | undefined
): void {
  const sop = program.command("sop").description("Standard Operating Procedures");

  sop
    .command("list")
    .option("--role <role>", "Filter by agent role")
    .description("List available SOPs")
    .action((opts: { role?: string }) => {
      const sopsDir = findSopsDir(getDir());
      let files: string[];
      try {
        files = readdirSync(sopsDir).filter((f) => f.endsWith(".md"));
      } catch {
        files = [];
      }

      const sops = files.map((f) => {
        const { meta } = parseSop(resolve(sopsDir, f));
        return meta;
      });

      const filtered = opts.role
        ? sops.filter((s) => s.role === opts.role)
        : sops;

      output(filtered, getFormat());
    });

  sop
    .command("show")
    .argument("<name>", "SOP name (filename without .md)")
    .description("Show SOP content (raw markdown)")
    .action((name: string) => {
      const sopsDir = findSopsDir(getDir());
      const filePath = resolve(sopsDir, `${name}.md`);
      try {
        const content = readFileSync(filePath, "utf-8");
        if (getFormat() === "json") {
          output({ name, content }, getFormat());
        } else {
          process.stdout.write(content);
        }
      } catch {
        process.stderr.write(`Error: SOP "${name}" not found in ${sopsDir}\n`);
        process.exit(1);
      }
    });

  sop
    .command("start")
    .argument("<name>", "SOP name to execute")
    .description("Parse SOP into structured steps for agent execution")
    .action((name: string) => {
      const sopsDir = findSopsDir(getDir());
      const filePath = resolve(sopsDir, `${name}.md`);
      try {
        readFileSync(filePath);
      } catch {
        process.stderr.write(`Error: SOP "${name}" not found in ${sopsDir}\n`);
        process.exit(1);
      }
      const parsed = parseSop(filePath);
      output(
        {
          sop: parsed.meta.name,
          role: parsed.meta.role,
          totalSteps: parsed.steps.length,
          steps: parsed.steps,
        },
        getFormat()
      );
    });

  sop
    .command("create")
    .requiredOption("--name <name>", "SOP name (used as filename)")
    .requiredOption("--role <role>", "Agent role this SOP applies to")
    .option("--frequency <freq>", "Execution frequency (e.g. hourly, daily, on-demand)", "on-demand")
    .option("--description <desc>", "Short description")
    .option("--steps <json>", "Steps as JSON array: [{\"title\":\"...\",\"commands\":[...],\"guidance\":\"...\"}]")
    .option("--template <type>", "Generate from template: hourly | review | onboard", "")
    .description("Create a new SOP file")
    .action(
      (opts: {
        name: string;
        role: string;
        frequency: string;
        description?: string;
        steps?: string;
        template?: string;
      }) => {
        const sopsDir = findSopsDir(getDir());
        if (!existsSync(sopsDir)) mkdirSync(sopsDir, { recursive: true });
        const filePath = resolve(sopsDir, `${opts.name}.md`);

        if (existsSync(filePath)) {
          process.stderr.write(`Error: SOP "${opts.name}" already exists at ${filePath}\n`);
          process.exit(1);
        }

        const desc = opts.description || `${opts.role} ${opts.frequency} routine`;
        let steps: { title: string; commands: string[]; guidance: string }[];

        if (opts.steps) {
          try {
            steps = JSON.parse(opts.steps);
          } catch {
            process.stderr.write("Error: --steps must be valid JSON array.\n");
            process.exit(1);
          }
        } else if (opts.template) {
          steps = getTemplateSteps(opts.template, opts.role);
        } else {
          steps = getTemplateSteps("hourly", opts.role);
        }

        // Build markdown
        let md = `---\nname: ${opts.name}\nrole: ${opts.role}\nfrequency: ${opts.frequency}\ndescription: ${desc}\n---\n\n`;
        md += `# ${capitalize(opts.role)} ${capitalize(opts.frequency)} SOP\n\n`;

        steps.forEach((step, i) => {
          md += `## Step ${i + 1}: ${step.title}\n`;
          if (step.commands.length > 0) {
            md += "```bash\n";
            md += step.commands.join("\n") + "\n";
            md += "```\n";
          }
          if (step.guidance) {
            md += step.guidance + "\n";
          }
          md += "\n";
        });

        writeFileSync(filePath, md.trimEnd() + "\n");
        output(
          {
            name: opts.name,
            role: opts.role,
            frequency: opts.frequency,
            description: desc,
            file: filePath,
            steps: steps.length,
            status: "created",
          },
          getFormat()
        );
      }
    );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getTemplateSteps(
  template: string,
  role: string
): { title: string; commands: string[]; guidance: string }[] {
  switch (template) {
    case "hourly":
      return [
        {
          title: "Check inbox",
          commands: ["atos mail inbox --unread"],
          guidance: "Read all unread messages. Identify action items, blockers, and informational updates.",
        },
        {
          title: "Check my tasks",
          commands: [`atos task list --mine --status open`],
          guidance: "Identify the highest priority task to work on this cycle.",
        },
        {
          title: "Execute work",
          commands: [],
          guidance:
            "Work on the top-priority open task.\n- If blocked, update status and notify hub:\n  ```bash\n  atos task update <id> --status blocked\n  atos mail send --to <hub> --subject \"[BLOCKED] Task #<id>\" --body \"Blocked on: <reason>\"\n  ```",
        },
        {
          title: "Update progress",
          commands: [
            `atos task done <id> --note "<what you completed>"`,
          ],
          guidance: "Mark completed tasks as done. For in-progress tasks, continue next cycle.",
        },
        {
          title: "Report to hub",
          commands: [
            `atos mail send --to <hub> --subject "[STATUS] ${role} hourly update" --body "<summary of this hour>"`,
          ],
          guidance: "Send a brief status update: what you did, what's next, any blockers.",
        },
      ];

    case "review":
      return [
        {
          title: "Collect status from all agents",
          commands: ["atos mail inbox --since 1h"],
          guidance: "Gather all status updates received in the last hour.",
        },
        {
          title: "Review task board",
          commands: ["atos task list --status open", "atos task list --status blocked"],
          guidance: "Check for overdue tasks, blocked items, and priority mismatches.",
        },
        {
          title: "Identify blockers and decisions needed",
          commands: [],
          guidance: "List any items that require leadership decision or cross-team coordination.",
        },
        {
          title: "Write digest",
          commands: [
            `atos mail send --to <leader> --subject "[STATUS] Review digest" --body "<completed, in-progress, blocked, decisions needed>"`,
          ],
          guidance: "Synthesize findings into a structured digest for the team lead.",
        },
      ];

    case "onboard":
      return [
        {
          title: "Check team members",
          commands: ["atos team members"],
          guidance: "Review who is on the team and their roles.",
        },
        {
          title: "Read recent messages",
          commands: ["atos mail inbox --limit 10"],
          guidance: "Understand the current state of team communication.",
        },
        {
          title: "Review open tasks",
          commands: ["atos task list --status open"],
          guidance: "Understand what work is in progress and what needs attention.",
        },
        {
          title: "Review SOPs",
          commands: [`atos sop list --role ${role}`],
          guidance: "Read through your role's SOPs to understand expected workflows.",
        },
        {
          title: "Introduce yourself",
          commands: [
            `atos mail send --to <hub> --subject "[INFO] ${role} online" --body "I'm online and ready to work. Reviewing current state."`,
          ],
          guidance: "Notify the hub that you are active and available.",
        },
      ];

    default:
      return [
        {
          title: "Check inbox",
          commands: ["atos mail inbox --unread"],
          guidance: "Process new messages.",
        },
        {
          title: "Execute work",
          commands: [],
          guidance: "Describe the main work to be done in this step.",
        },
        {
          title: "Report",
          commands: [
            `atos mail send --to <hub> --subject "[STATUS] ${role} update" --body "<summary>"`,
          ],
          guidance: "Send status update to the hub.",
        },
      ];
  }
}
