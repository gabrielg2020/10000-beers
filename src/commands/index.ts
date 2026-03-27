import { commandRegistry } from './commandRegistry';
import { LeaderbaordCommand } from './leaderboardCommand';
import { ReleaseCommand } from './releaseCommand';
import { RemoveLastCommand } from './removeLastCommand';
import { StatsCommand } from './statsCommand';
import { UndoCommand } from './undoCommand';

commandRegistry.register(new LeaderbaordCommand());
commandRegistry.register(new ReleaseCommand());
commandRegistry.register(new RemoveLastCommand());
commandRegistry.register(new StatsCommand());
commandRegistry.register(new UndoCommand());

export { commandRegistry } from './commandRegistry';
export { commandHandler } from '../handlers/commandHandler';
