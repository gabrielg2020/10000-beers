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
