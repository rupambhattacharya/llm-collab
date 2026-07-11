import { logger } from "../utils/logger.js";

export interface ScanResult {
  found: boolean;
  matches: SecretMatch[];
}

export interface SecretMatch {
  pattern: string;
  line: number;
  excerpt: string;
}

interface SecretPattern {
  name: string;
  regex: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/g },
  { name: "AWS Secret Key", regex: /(?:aws_secret_access_key|secret_access_key)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi },
  { name: "GitHub Token", regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/g },
  { name: "GitHub Classic Token", regex: /github_pat_[A-Za-z0-9_]{22,255}/g },
  { name: "Anthropic API Key", regex: /sk-ant-[A-Za-z0-9-_]{20,}/g },
  { name: "OpenAI API Key", regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: "Linear API Key", regex: /lin_api_[A-Za-z0-9]{30,}/g },
  { name: "Slack Token", regex: /xox[boaprs]-[0-9A-Za-z-]{10,}/g },
  { name: "Slack Webhook", regex: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+/g },
  { name: "Generic Private Key", regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
  { name: "Generic Secret Assignment", regex: /(?:password|passwd|secret|api_key|apikey|access_token)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
];

export function scanForSecrets(text: string): ScanResult {
  const matches: SecretMatch[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        const excerpt = line.length > 80 ? line.slice(0, 77) + "..." : line;
        matches.push({
          pattern: pattern.name,
          line: i + 1,
          excerpt: maskExcerpt(excerpt),
        });
      }
    }
  }

  return { found: matches.length > 0, matches };
}

function maskExcerpt(text: string): string {
  return text.replace(/([A-Za-z0-9/+=_-]{8})[A-Za-z0-9/+=_-]{8,}/g, "$1****");
}

export type SecretAction = "warn" | "block";

export function handleSecretScan(
  text: string,
  action: SecretAction = "warn",
): { safe: boolean; text: string } {
  const result = scanForSecrets(text);
  if (!result.found) return { safe: true, text };

  for (const match of result.matches) {
    logger.warn(`Possible ${match.pattern} detected on line ${match.line}: ${match.excerpt}`);
  }

  if (action === "block") {
    logger.error(`Blocked output containing ${result.matches.length} potential secret(s)`);
    return { safe: false, text: "[OUTPUT BLOCKED — contains potential secrets]" };
  }

  logger.warn(`Warning: output may contain ${result.matches.length} secret(s). Review before sharing.`);
  return { safe: true, text };
}
