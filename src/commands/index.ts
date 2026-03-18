import { commandRegistry } from "./commandRegistry";
import { LeaderbaordCommand } from "./leaderboardCommand";
import { RemoveLastCommand } from "./removeLastCommand";

commandRegistry.register(new LeaderbaordCommand());
commandRegistry.register(new RemoveLastCommand());

export { commandRegistry } from './commandRegistry';
export { commandHandler } from '../handlers/commandHandler';
