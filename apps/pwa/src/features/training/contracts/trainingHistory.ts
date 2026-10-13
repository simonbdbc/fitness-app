export type SessionPainLevel = "none" | "mild" | "pain";
export type SessionProgressionPreference = "easier" | "same" | "harder";

export type RecentWeeklyProgramStats = {
  successRate: number;
  fatigue: number;
  skippedSessions: number;
  painRate: number;
  progressionNeeded: boolean;
  regressionNeeded: boolean;
};

export type CandidateRecentStats = {
  sessionTemplateId: number;
  exerciseId: number;
  formatId: number;
  stats: RecentWeeklyProgramStats;
};

export type WeeklyProgramHistory = {
  recentStats: RecentWeeklyProgramStats;
  candidateRecentStats: CandidateRecentStats[];
};

export type TrainingHistoryPort = {
  loadRecentWeeklyProgramHistory: (
    profileCode: string,
  ) => Promise<WeeklyProgramHistory>;
};
