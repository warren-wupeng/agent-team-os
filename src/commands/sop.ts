import { Command } from "commander";
import { readdirSync, readFileSync } from "node:fs";
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
}
