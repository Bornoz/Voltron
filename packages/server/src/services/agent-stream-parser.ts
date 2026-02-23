import { EventEmitter } from 'node:events';
import { AGENT_CONSTANTS } from '@voltron/shared';
import type { AgentActivity, AgentLocation } from '@voltron/shared';

/**
 * Parses Claude CLI's `--output-format stream-json` stdout line-by-line.
 * Emits structured events for location changes, tool usage, thinking, and output.
 */

export interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

export interface LocationChangeEvent {
  filePath: string;
  activity: AgentActivity;
  toolName?: string;
  lineRange?: { start: number; end: number };
  timestamp: number;
}

export interface ToolEvent {
  toolName: string;
  input: Record<string, unknown>;
  timestamp: number;
}

export interface TokenUsageEvent {
  inputTokens: number;
  outputTokens: number;
}

export class AgentStreamParser extends EventEmitter {
  private buffer = '';
  private lastLocationUpdate = 0;
  private accumulatedThinking = '';
  private currentToolName: string | null = null;

  /**
   * Feed raw stdout data chunks into the parser.
   */
  feed(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      this.parseLine(trimmed);
    }
  }

  /**
   * Flush any remaining buffer (call on stream end).
   */
  flush(): void {
    if (this.buffer.trim()) {
      this.parseLine(this.buffer.trim());
      this.buffer = '';
    }
    if (this.accumulatedThinking) {
      this.emit('thinking', this.accumulatedThinking);
      this.accumulatedThinking = '';
    }
  }

  private parseLine(line: string): void {
    let event: StreamEvent;
    try {
      event = JSON.parse(line) as StreamEvent;
    } catch {
      // Non-JSON output line
      this.emit('raw_output', line);
      return;
    }

    switch (event.type) {
      case 'assistant': {
        // Assistant message with content blocks
        const message = event.message as { content?: Array<{ type: string; text?: string; thinking?: string }> } | undefined;
        if (message?.content) {
          for (const block of message.content) {
            if (block.type === 'thinking' && block.thinking) {
              this.accumulatedThinking += block.thinking + '\n';
              this.emit('thinking_block', block.thinking);
            } else if (block.type === 'text' && block.text) {
              this.emit('text_output', block.text);
            }
          }
        }
        break;
      }

      case 'content_block_start': {
        const block = event.content_block as { type: string; name?: string } | undefined;
        if (block?.type === 'tool_use' && block.name) {
          this.currentToolName = block.name;
        }
        break;
      }

      case 'content_block_delta': {
        const delta = event.delta as { type: string; thinking?: string; text?: string; partial_json?: string } | undefined;
        if (delta?.type === 'thinking_delta' && delta.thinking) {
          this.accumulatedThinking += delta.thinking;
        } else if (delta?.type === 'text_delta' && delta.text) {
          this.emit('text_delta', delta.text);
        } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
          // Accumulate tool input JSON for location extraction
        }
        break;
      }

      case 'content_block_stop': {
        if (this.accumulatedThinking) {
          this.emit('thinking', this.accumulatedThinking);
          this.emit('plan_detected', this.accumulatedThinking);
          this.accumulatedThinking = '';
        }
        this.currentToolName = null;
        break;
      }

      case 'result': {
        // Final result with tool outputs
        const result = event as { subtype?: string; cost_usd?: number; duration_ms?: number; duration_api_ms?: number; is_error?: boolean; result?: string; session_id?: string; num_turns?: number; usage?: { input_tokens?: number; output_tokens?: number } };
        if (result.usage) {
          this.emit('token_usage', {
            inputTokens: result.usage.input_tokens ?? 0,
            outputTokens: result.usage.output_tokens ?? 0,
          } as TokenUsageEvent);
        }
        this.emit('session_end', {
          isError: result.is_error ?? false,
          result: result.result,
          sessionId: result.session_id,
          costUsd: result.cost_usd,
          durationMs: result.duration_ms,
          numTurns: result.num_turns,
        });
        break;
      }

      // Tool use events from Claude
      case 'tool_use': {
        const toolName = (event.name ?? this.currentToolName ?? 'unknown') as string;
        const input = (event.input ?? {}) as Record<string, unknown>;
        const now = Date.now();

        this.emit('tool_start', { toolName, input, timestamp: now } as ToolEvent);

        // Extract file path and activity from tool usage
        const filePathKey = AGENT_CONSTANTS.TOOL_FILE_PATH_MAP[toolName];
        const activity = (AGENT_CONSTANTS.TOOL_ACTIVITY_MAP[toolName] ?? 'THINKING') as AgentActivity;

        if (filePathKey && input[filePathKey]) {
          const filePath = String(input[filePathKey]);
          this.emitLocationThrottled({
            filePath,
            activity,
            toolName,
            lineRange: this.extractLineRange(input),
            timestamp: now,
          });
        } else if (activity !== 'THINKING') {
          // Tool without file path (e.g., Bash)
          this.emit('activity_change', activity);
        }
        break;
      }

      case 'tool_result': {
        this.emit('tool_end', { timestamp: Date.now() });
        break;
      }

      // Message events
      case 'message_start': {
        const usage = (event.message as { usage?: { input_tokens?: number; output_tokens?: number } })?.usage;
        if (usage) {
          this.emit('token_usage', {
            inputTokens: usage.input_tokens ?? 0,
            outputTokens: usage.output_tokens ?? 0,
          } as TokenUsageEvent);
        }
        break;
      }

      case 'message_delta': {
        const delta = event.delta as { stop_reason?: string } | undefined;
        const usage = event.usage as { output_tokens?: number } | undefined;
        if (usage) {
          this.emit('token_usage_delta', { outputTokens: usage.output_tokens ?? 0 });
        }
        if (delta?.stop_reason === 'end_turn') {
          this.emit('turn_end', {});
        }
        break;
      }

      default:
        // Unknown event type - emit for debugging
        this.emit('unknown_event', event);
        break;
    }
  }

  private emitLocationThrottled(location: LocationChangeEvent): void {
    const now = Date.now();
    if (now - this.lastLocationUpdate >= AGENT_CONSTANTS.LOCATION_THROTTLE_MS) {
      this.lastLocationUpdate = now;
      this.emit('location_change', location);
    }
  }

  private extractLineRange(input: Record<string, unknown>): { start: number; end: number } | undefined {
    // Edit tool has line range info
    if (input.offset !== undefined && input.limit !== undefined) {
      return {
        start: Number(input.offset) || 1,
        end: (Number(input.offset) || 1) + (Number(input.limit) || 0),
      };
    }
    return undefined;
  }
}
