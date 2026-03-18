import type { Message } from "whatsapp-web.js";

export interface CommandContext {
  message: Message;
  args: string[];
  whatsappId: string;
  displayName: string;
}

export interface CommandResult {
  success: boolean;
  reply?: string;
  error?: string;
}

export interface Command {
  readonly name: string;
  readonly aliases: string[];
  readonly description: string;
  execute(context: CommandContext): Promise<CommandResult>;
}
