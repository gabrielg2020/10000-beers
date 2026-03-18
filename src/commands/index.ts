import { commandRegistry } from "./commandRegistry";
import { LeaderbaordCommand } from "./leaderboardCommand";

commandRegistry.register(new LeaderbaordCommand());

export { commandRegistry } from './commandRegistry';
export { commandHandler } from '../handlers/commandHandler'
