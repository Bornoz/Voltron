import { create } from 'zustand';
import type { AiActionEvent, RiskLevel, OperationType } from '@voltron/shared';

const MAX_EVENTS = 5000;

export interface EventFilter {
  riskLevels?: RiskLevel[];
  actionTypes?: OperationType[];
  fileSearch?: string;
}

interface EventState {
  events: AiActionEvent[];
  selectedEvent: AiActionEvent | null;
  filter: EventFilter;

  addEvent: (event: AiActionEvent) => void;
  addEvents: (events: AiActionEvent[]) => void;
  setSelectedEvent: (event: AiActionEvent | null) => void;
  setFilter: (filter: Partial<EventFilter>) => void;
  clearEvents: () => void;
  getFilteredEvents: () => AiActionEvent[];
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  selectedEvent: null,
  filter: {},

  addEvent: (event) =>
    set((state) => {
      const events = [event, ...state.events];
      if (events.length > MAX_EVENTS) {
        events.length = MAX_EVENTS;
      }
      return { events };
    }),

  addEvents: (newEvents) =>
    set((state) => {
      const events = [...newEvents, ...state.events];
      if (events.length > MAX_EVENTS) {
        events.length = MAX_EVENTS;
      }
      return { events };
    }),

  setSelectedEvent: (event) => set({ selectedEvent: event }),

  setFilter: (partial) =>
    set((state) => ({
      filter: { ...state.filter, ...partial },
    })),

  clearEvents: () => set({ events: [], selectedEvent: null }),

  getFilteredEvents: () => {
    const { events, filter } = get();
    let result = events;

    if (filter.riskLevels && filter.riskLevels.length > 0) {
      result = result.filter((e) => filter.riskLevels!.includes(e.risk));
    }
    if (filter.actionTypes && filter.actionTypes.length > 0) {
      result = result.filter((e) => filter.actionTypes!.includes(e.action));
    }
    if (filter.fileSearch && filter.fileSearch.trim()) {
      const search = filter.fileSearch.toLowerCase().trim();
      result = result.filter((e) => e.file.toLowerCase().includes(search));
    }

    return result;
  },
}));
