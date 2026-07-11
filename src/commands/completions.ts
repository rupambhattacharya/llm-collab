import { Command } from "commander";
import { logger } from "../utils/logger.js";

const COMMANDS = [
  "setup", "config", "agent", "chat", "mcp", "relay",
  "chronicle", "github", "linear", "skills", "costs",
  "audit", "completions",
];

const SUBCOMMANDS: Record<string, string[]> = {
  config: ["get", "set", "list", "path"],
  agent: ["claude", "codex", "opencode", "install", "list"],
  mcp: ["stdio", "http"],
  chronicle: ["init", "push", "search", "ask", "graph", "timeline", "stats"],
  github: ["issues", "prs", "ci"],
  linear: ["issues", "teams", "projects"],
  skills: ["list", "install", "search"],
  audit: ["show", "tail", "dates"],
  completions: ["bash", "zsh", "fish"],
};

function generateBash(): string {
  const subcommandCases = Object.entries(SUBCOMMANDS)
    .map(([cmd, subs]) => `      ${cmd}) COMPREPLY=($(compgen -W "${subs.join(" ")}" -- "\${cur}")) ;;`)
    .join("\n");

  return `# llm-collab bash completion
# Add to ~/.bashrc: eval "$(llm-collab completions bash)"
_llm_collab() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="${COMMANDS.join(" ")}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=($(compgen -W "\${commands}" -- "\${cur}"))
    return 0
  fi

  case "\${COMP_WORDS[1]}" in
${subcommandCases}
  esac
}
complete -F _llm_collab llm-collab`;
}

function generateZsh(): string {
  const subcommandCases = Object.entries(SUBCOMMANDS)
    .map(([cmd, subs]) => `    ${cmd}) compadd ${subs.join(" ")} ;;`)
    .join("\n");

  return `#compdef llm-collab
# llm-collab zsh completion
# Add to ~/.zshrc: eval "$(llm-collab completions zsh)"
_llm-collab() {
  local -a commands
  commands=(${COMMANDS.join(" ")})

  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi

  case "\${words[2]}" in
${subcommandCases}
  esac
}
_llm-collab "$@"`;
}

function generateFish(): string {
  const lines = [
    "# llm-collab fish completion",
    '# Add to ~/.config/fish/completions/llm-collab.fish',
    "",
  ];

  for (const cmd of COMMANDS) {
    lines.push(`complete -c llm-collab -n '__fish_use_subcommand' -a '${cmd}'`);
  }

  for (const [cmd, subs] of Object.entries(SUBCOMMANDS)) {
    for (const sub of subs) {
      lines.push(`complete -c llm-collab -n '__fish_seen_subcommand_from ${cmd}' -a '${sub}'`);
    }
  }

  return lines.join("\n");
}

export const completionsCommand = new Command("completions")
  .description("Generate shell completions")
  .addCommand(
    new Command("bash")
      .description("Generate bash completions")
      .action(() => {
        logger.passThrough(generateBash());
      }),
  )
  .addCommand(
    new Command("zsh")
      .description("Generate zsh completions")
      .action(() => {
        logger.passThrough(generateZsh());
      }),
  )
  .addCommand(
    new Command("fish")
      .description("Generate fish completions")
      .action(() => {
        logger.passThrough(generateFish());
      }),
  );
