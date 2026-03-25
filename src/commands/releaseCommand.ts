import { config } from '../config';
import { logger } from '../utils/logger';
import type { Command, CommandContext, CommandResult } from './types';

interface GitHubRelease {
	tag_name: string;
	name: string;
	body: string;
	html_url: string;
	published_at: string;
	author: {
		login: string;
	};
}

export class ReleaseCommand implements Command {
	readonly name = 'release';
	readonly aliases = ['rel'];
	readonly description = 'Fetch and display the latest GitHub release';
	readonly adminOnly = true;

	async execute(context: CommandContext): Promise<CommandResult> {
		try {
			logger.debug(
				{ whatsappId: context.whatsappId },
				'Executing release command',
			);

			// Get specific version if provided, otherwise latest
			const version = context.args[0];
			const release = await this.fetchRelease(version);

			const reply = this.formatRelease(release);

			return {
				success: true,
				reply,
			};
		} catch (error) {
			logger.error({ error, context }, 'Release command failed');

			if (error instanceof Error && error.message.includes('404')) {
				return {
					success: false,
					reply: 'No release found. Check the repository or version tag.',
				};
			}

			return {
				success: false,
				reply: 'Failed to fetch release information. Please try again.',
			};
		}
	}

	private async fetchRelease(version?: string): Promise<GitHubRelease> {
		const { repoOwner, repoName } = config.github;
		const url = version
			? `https://api.github.com/repos/${repoOwner}/${repoName}/releases/tags/${version}`
			: `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;

		logger.debug({ url }, 'Fetching GitHub release');

		const response = await fetch(url, {
			headers: {
				Accept: 'application/vnd.github+json',
				'User-Agent': '10000-beers-bot',
			},
		});

		if (!response.ok) {
			throw new Error(`GitHub API returned ${response.status}`);
		}

		return response.json() as Promise<GitHubRelease>;
	}

	private formatRelease(release: GitHubRelease): string {
		const lines: string[] = ['🚀 New Release 🎉', ''];

		// Title
		lines.push(release.name || release.tag_name);
		lines.push('');

		// Release notes (strip markdown but keep bullet points)
		if (release.body) {
			const body = this.stripMarkdown(release.body.trim());
			lines.push(body);
			lines.push('');
		}

		// Link
		lines.push(`🔗 ${release.html_url}`);

		return lines.join('\n');
	}

	private stripMarkdown(text: string): string {
		return text
			.replace(/^#{1,6}\s+/gm, '') // Remove heading markers
			.replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
			.replace(/\*(.+?)\*/g, '$1') // Remove italic
			.replace(/__(.+?)__/g, '$1') // Remove bold (underscore)
			.replace(/_(.+?)_/g, '$1') // Remove italic (underscore)
			.replace(/~~(.+?)~~/g, '$1'); // Remove strikethrough
	}
}
