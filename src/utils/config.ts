export function getAgent(agentFlag?: string): string {
  const agent = agentFlag || process.env.ATOS_AGENT;
  if (!agent) {
    process.stderr.write(
      "Error: Agent identity required. Set ATOS_AGENT env var or use --agent flag.\n"
    );
    process.exit(1);
  }
  return agent;
}

export function getAtosDir(dirFlag?: string): string {
  return dirFlag || ".atos";
}
