// src/services/EventCalendarService.ts — Market event calendar with AI impact prediction

import { BaseService } from './BaseService';
import { AIAnalysisService } from './AIAnalysisService';

export interface MarketEvent {
  id: string;
  date: string;
  title: string;
  category: 'RBI' | 'EARNINGS' | 'EXPIRY' | 'FII_DATA' | 'GDP' | 'IPO' | 'CORPORATE_ACTION' | 'GLOBAL';
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  aiPrediction?: string; // AI-generated impact prediction
}

export interface EventCalendarData {
  month: string;
  events: MarketEvent[];
  highImpactCount: number;
}

export class EventCalendarService extends BaseService {
  private aiService: AIAnalysisService | null;

  // Known recurring market events (template)
  private readonly RECURRING_EVENTS = [
    { dayOfMonth: -1, title: 'Monthly F&O Expiry', category: 'EXPIRY' as const, impact: 'HIGH' as const },
    { dayOfMonth: 1, title: 'Auto Sales Data Release', category: 'CORPORATE_ACTION' as const, impact: 'MEDIUM' as const },
  ];

  constructor(aiService: AIAnalysisService | null) {
    super('EventCalendarService');
    this.aiService = aiService;
  }

  /**
   * Get market events for a given month with AI impact predictions
   */
  async getMonthlyCalendar(year: number, month: number): Promise<EventCalendarData> {
    const events: MarketEvent[] = [];
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    // 1. Add known recurring events
    const lastDayOfMonth = new Date(year, month, 0).getDate();

    // Find last Thursday (F&O monthly expiry)
    const lastThursday = this.getLastThursday(year, month);
    events.push({
      id: `evt_expiry_${monthStr}`,
      date: lastThursday.toISOString().split('T')[0],
      title: 'Monthly F&O Expiry',
      category: 'EXPIRY',
      impactLevel: 'HIGH',
      description: `Nifty & Bank Nifty monthly options expiry. Expect high volatility and max pain driven moves.`,
    });

    // Weekly expiries (every Thursday)
    const firstDay = new Date(year, month - 1, 1);
    for (let d = 1; d <= lastDayOfMonth; d++) {
      const date = new Date(year, month - 1, d);
      if (date.getDay() === 4 && date.getTime() !== lastThursday.getTime()) {
        events.push({
          id: `evt_weekly_${monthStr}_${d}`,
          date: date.toISOString().split('T')[0],
          title: 'Weekly F&O Expiry',
          category: 'EXPIRY',
          impactLevel: 'MEDIUM',
          description: 'Nifty weekly options expiry.',
        });
      }
    }

    // RBI Policy (typically 1st week of Feb, Apr, Jun, Aug, Oct, Dec)
    const rbiMonths = [2, 4, 6, 8, 10, 12];
    if (rbiMonths.includes(month)) {
      const rbiDate = new Date(year, month - 1, 6); // Approximate
      events.push({
        id: `evt_rbi_${monthStr}`,
        date: rbiDate.toISOString().split('T')[0],
        title: 'RBI Monetary Policy Decision',
        category: 'RBI',
        impactLevel: 'HIGH',
        description: 'Reserve Bank of India interest rate decision and policy statement.',
      });
    }

    // 2. Add AI predictions for high-impact events
    if (this.aiService) {
      for (const event of events) {
        if (event.impactLevel === 'HIGH') {
          try {
            const prompt = `You are a market analyst. In one concise sentence (max 80 chars), predict the likely impact of "${event.title}" on ${event.date} on Indian markets (Nifty/Bank Nifty). Output only the prediction text.`;
            event.aiPrediction = await this.aiService.generateContent(prompt);
          } catch {
            event.aiPrediction = 'AI prediction unavailable';
          }
        }
      }
    }

    // Sort by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      month: monthStr,
      events,
      highImpactCount: events.filter(e => e.impactLevel === 'HIGH').length,
    };
  }

  private getLastThursday(year: number, month: number): Date {
    const lastDay = new Date(year, month, 0); // Last day of the month
    const dayOfWeek = lastDay.getDay();
    const diff = (dayOfWeek >= 4) ? dayOfWeek - 4 : dayOfWeek + 3;
    lastDay.setDate(lastDay.getDate() - diff);
    return lastDay;
  }
}
