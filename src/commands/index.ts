import { commandRegistry } from "./commandRegistry";
import { LeaderbaordCommand } from "./leaderboardCommand";
import { RemoveLastCommand } from "./removeLastCommand";
import { UndoCommand } from "./undoCommand";

commandRegistry.register(new LeaderbaordCommand());
commandRegistry.register(new RemoveLastCommand());
commandRegistry.register(new UndoCommand());

export { commandRegistry } from './commandRegistry';
export { commandHandler } from '../handlers/commandHandler';
