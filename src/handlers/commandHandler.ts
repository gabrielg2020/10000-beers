import type { Message } from 'whatsapp-web.js';
import { commandRegistry } from '../commands/commandRegistry';
import { logger } from '../utils/logger';
import type { CommandContext } from '../commands/types';
import { CommandError } from '../types/statistics';

export class CommandHandler {
	private readonly commandPrefix = '!';

	isCommand(messageBody: string): boolean {
		return messageBody.trim().startsWith(this.commandPrefix);
	}

	parseCommand(messageBody: string): { commandName: string; args: string[] } {
		const trimmed = messageBody.trim();
		const withoutPrefix = trimmed.slice(this.commandPrefix.length);
		const parts = withoutPrefix.split(/\s+/);

		return {
			commandName: parts[0] || '',
			args: parts.slice(1),
		};
	}

	async handleCommand(message: Message): Promise<void> {
		const messageBody = message.body;

		if (!this.isCommand(messageBody)) {
			return;
		}

		const { commandName, args } = this.parseCommand(messageBody);

		if (!commandName) {
			return;
		}

		const command = commandRegistry.get(commandName);

		if (!command) {
			logger.debug({ commandName }, 'Unkown command');
			return;
		}

		try {
			const contact = await message.getContact();
			const whatsappId = contact.id._serialized;
			const displayName = contact.pushname || contact.name || 'Unknown';

			const context: CommandContext = {
				message,
				args,
				whatsappId,
				displayName,
			};

			logger.info(
				{ command: command.name, whatsappId, args },
				'Executing command',
			);

			const result = await command.execute(context);

			if (result.reply) {
				await message.reply(result.reply);
			}
		} catch (error) {
			if (error instanceof CommandError) {
				await message.reply(error.userMessage);
				logger.warn(
					{ code: error.code, message: error.message },
					'Command execution failed',
				);
			} else {
				logger.error({ error, commandName }, 'Unexpected command error');
				await message.reply('Something went wrong. Please try again');
			}
		}
	}
}

export const commandHandler = new CommandHandler();
