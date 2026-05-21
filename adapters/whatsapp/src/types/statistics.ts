import { BeerType } from "@prisma/client";

export interface UserStatistics {
  userId: string;
  whatsappId: string;
  displayName: string;
  totalBeers: number;
  rank: number;
  firstBeerDate: Date | null;
  favouriteBeerType: BeerType | null;
  averageBeersPerWeek: number;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalBeers: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[]
  totalUsers: number;
  totalBeers: number;
}

export interface GroupStatistics {
  totalBeers: number;
  totalUsers: number;
  nextMilestone: number;
  beersUntilMilestone: number;
}

export interface PeriodStats {
  totalBeers: number;
  topDrinker: {
    displayName: string;
    beerCount: number;
  } | null;
}

export interface DualPeriodStats {
  calendar: PeriodStats;
  rolling: PeriodStats;
}

export interface WeekendStats {
  thisWeekend?: PeriodStats;
  lastWeekend: PeriodStats;
}

export class CommandError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = 'CommandError';
  }
}
