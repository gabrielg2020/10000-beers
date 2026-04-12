export type TimePeriod = 'day' | 'week' | 'month' | 'weekend';

export const VALID_PERIODS: TimePeriod[] = ['day', 'week', 'month', 'weekend'];

export interface DateRange {
	start: Date;
	end: Date;
}

export interface WeekendDateRanges {
	thisWeekend?: DateRange;
	lastWeekend: DateRange;
}

export function isValidPeriod(value: string): value is TimePeriod {
	return VALID_PERIODS.includes(value as TimePeriod);
}

export function getCalendarRange(
	period: 'day' | 'week' | 'month',
	now: Date = new Date(),
): DateRange {
	switch (period) {
		case 'day': {
			const start = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate(),
			);
			return { start, end: now };
		}
		case 'week': {
			const dayOfWeek = now.getDay();
			const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
			const start = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate() - daysFromMonday,
			);
			return { start, end: now };
		}
		case 'month': {
			const start = new Date(now.getFullYear(), now.getMonth(), 1);
			return { start, end: now };
		}
	}
}

export function getRollingRange(
	period: 'day' | 'week' | 'month',
	now: Date = new Date(),
): DateRange {
	switch (period) {
		case 'day': {
			const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
			return { start, end: now };
		}
		case 'week': {
			const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
			return { start, end: now };
		}
		case 'month': {
			const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			return { start, end: now };
		}
	}
}

export function getWeekendRanges(now: Date = new Date()): WeekendDateRanges {
	const dayOfWeek = now.getDay();

	if (dayOfWeek >= 5 || dayOfWeek === 0) {
		const daysFromThisFriday = dayOfWeek === 0 ? 2 : dayOfWeek - 5;
		const thisFridayMidnight = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() - daysFromThisFriday,
		);

		const daysFromLastFriday = daysFromThisFriday + 7;
		const lastFridayMidnight = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() - daysFromLastFriday,
		);
		const lastSundayEnd = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() - daysFromThisFriday - 1,
			23,
			59,
			59,
			999,
		);

		return {
			thisWeekend: { start: thisFridayMidnight, end: now },
			lastWeekend: { start: lastFridayMidnight, end: lastSundayEnd },
		};
	}

	const daysFromLastFriday = dayOfWeek + 2;
	const lastFridayMidnight = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate() - daysFromLastFriday,
	);
	const lastSundayEnd = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate() - (dayOfWeek - 1),
		23,
		59,
		59,
		999,
	);

	return {
		lastWeekend: { start: lastFridayMidnight, end: lastSundayEnd },
	};
}
