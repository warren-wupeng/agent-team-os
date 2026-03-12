export type Format = "json" | "human";

export function output(data: unknown, format: Format = "json"): void {
  if (format === "json") {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  } else {
    prettyPrint(data);
  }
}

function prettyPrint(data: unknown): void {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      process.stdout.write("(empty)\n");
      return;
    }
    const keys = Object.keys(data[0] as Record<string, unknown>);
    const widths = keys.map((k) =>
      Math.max(
        k.length,
        ...data.map((row) => String((row as Record<string, unknown>)[k] ?? "").length)
      )
    );
    // Header
    process.stdout.write(
      keys.map((k, i) => k.padEnd(widths[i])).join("  ") + "\n"
    );
    process.stdout.write(widths.map((w) => "-".repeat(w)).join("  ") + "\n");
    // Rows
    for (const row of data) {
      process.stdout.write(
        keys
          .map((k, i) =>
            String((row as Record<string, unknown>)[k] ?? "").padEnd(widths[i])
          )
          .join("  ") + "\n"
      );
    }
  } else if (typeof data === "object" && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      process.stdout.write(`${key}: ${value}\n`);
    }
  } else {
    process.stdout.write(String(data) + "\n");
  }
}

/** Message size limits */
const SOFT_LIMIT = 4096;
const HARD_LIMIT = 16384;

export function checkMessageSize(body: string): void {
  const size = Buffer.byteLength(body, "utf-8");
  if (size > HARD_LIMIT) {
    process.stderr.write(
      `Error: Message body (${size} bytes) exceeds hard limit (${HARD_LIMIT} bytes). Use a file attachment instead.\n`
    );
    process.exit(1);
  }
  if (size > SOFT_LIMIT) {
    process.stderr.write(
      `Warning: Message body (${size} bytes) exceeds recommended limit (${SOFT_LIMIT} bytes).\n`
    );
  }
}
