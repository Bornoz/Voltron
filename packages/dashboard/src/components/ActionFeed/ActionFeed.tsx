import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { ScrollText } from 'lucide-react';
import { useEventStore } from '../../stores/eventStore';
import { ActionEntry } from './ActionEntry';
import { ActionFilter } from './ActionFilter';
import { EmptyState } from '../common/EmptyState';
import { useTranslation } from '../../i18n';
import type { AiActionEvent } from '@voltron/shared';

export function ActionFeed() {
  const { t } = useTranslation();
  const allEvents = useEventStore((s) => s.events);
  const filter = useEventStore((s) => s.filter);

  const events = useMemo(() => {
    let result = allEvents;
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
  }, [allEvents, filter]);
  const selectedEvent = useEventStore((s) => s.selectedEvent);
  const setSelectedEvent = useEventStore((s) => s.setSelectedEvent);
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-scroll to top when new events arrive (unless paused)
  useEffect(() => {
    if (autoScroll && !isHovered && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events.length, autoScroll, isHovered]);

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    // If scrolled to top, re-enable auto-scroll
    setAutoScroll(listRef.current.scrollTop < 50);
  }, []);

  const handleSelect = useCallback(
    (event: AiActionEvent) => {
      setSelectedEvent(selectedEvent?.id === event.id ? null : event);
    },
    [selectedEvent, setSelectedEvent],
  );

  return (
    <div className="flex flex-col h-full">
      <ActionFilter />

      {/* Feed header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800 bg-gray-900/30">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
          {t('actionFeed.title')}
        </span>
        <div className="flex items-center gap-2">
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (listRef.current) listRef.current.scrollTop = 0;
              }}
              className="text-[10px] text-blue-400 hover:text-blue-300"
            >
              {t('actionFeed.scrollToLatest')}
            </button>
          )}
          <span className="text-[10px] text-gray-600">{events.length} {t('actionFeed.events')}</span>
        </div>
      </div>

      {/* Event list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex-1 overflow-y-auto"
      >
        {events.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="w-12 h-12" />}
            title={t('actionFeed.noEventsTitle')}
            description={t('actionFeed.noEventsDescription')}
          />
        ) : (
          events.map((event) => (
            <ActionEntry
              key={event.id}
              event={event}
              isSelected={selectedEvent?.id === event.id}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
