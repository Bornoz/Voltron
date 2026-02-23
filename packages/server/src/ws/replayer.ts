import { v4 as uuid } from 'uuid';
import { ActionRepository } from '../db/repositories/actions.js';
import { getDb } from '../db/connection.js';

export class Replayer {
  private actionRepo = new ActionRepository();

  getMissedEvents(projectId: string, lastSequenceNumber: number, clientId?: string): unknown[] {
    const replayStartedAt = Date.now();
    const events = this.actionRepo.getAfterSequence(projectId, lastSequenceNumber);
    const messages = events.map(event => ({
      type: 'EVENT_BROADCAST',
      payload: event,
      timestamp: event.timestamp,
    }));

    // Log replay to journal
    if (clientId && events.length > 0) {
      try {
        getDb().prepare(`
          INSERT INTO replay_journal (id, client_id, project_id, last_sequence_number, events_replayed, replay_started_at, replay_completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuid(),
          clientId,
          projectId,
          lastSequenceNumber,
          events.length,
          replayStartedAt,
          Date.now(),
        );
      } catch (err) {
        console.warn('[Replayer] Failed to log replay journal:', err instanceof Error ? err.message : err);
      }
    }

    return messages;
  }
}
