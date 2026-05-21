import { logger } from "../utils/logger";
import type { Command } from "./types";

export class CommandRegistry {
  private commands: Map<string, Command> = new Map();

  register(command: Command): void {
    // Primary name
    this.commands.set(command.name.toLowerCase(), command);

    // Aliases
    for (const aliases of command.aliases) {
      this.commands.set(aliases.toLowerCase(), command);
    }

    logger.info(
      { name: command.name, aliases: command.aliases},
      'Command reegisterd',
    );
  }

  get(commandName: string): Command | undefined {
    return this.commands.get(commandName.toLowerCase());
  }

  has(commandName: string): boolean {
    return this.commands.has(commandName.toLowerCase());
  }

  getAllCommands(): Command[] {
    const uniqueCommands = new Map<string, Command>();

    for (const command of this.commands.values()) {
      uniqueCommands.set(command.name, command);
    }

    return Array.from(uniqueCommands.values());
  }
}

export const commandRegistry = new CommandRegistry();
