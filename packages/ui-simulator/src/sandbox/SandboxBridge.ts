/**
 * SandboxBridge manages postMessage communication between host and iframe.
 * It handles origin validation, message serialization, and the bidirectional protocol.
 */

export type OutboundMessageType =
  | 'INJECT_STYLES'
  | 'UPDATE_LAYOUT'
  | 'UPDATE_PROPS'
  | 'REQUEST_SNAPSHOT'
  | 'SELECT_ELEMENT'
  | 'ENABLE_DRAG_MODE'
  | 'ADD_ELEMENT'
  | 'DELETE_ELEMENT'
  | 'DUPLICATE_ELEMENT'
  | 'SHOW_ELEMENT_TOOLBAR'
  | 'REQUEST_DESIGN_SNAPSHOT';

export type InboundMessageType =
  | 'ELEMENT_SELECTED'
  | 'DOM_MUTATED'
  | 'STYLE_APPLIED'
  | 'LAYOUT_APPLIED'
  | 'STATE_SNAPSHOT'
  | 'BRIDGE_READY'
  | 'ERROR'
  | 'ELEMENT_MOVED'
  | 'ELEMENT_ADDED'
  | 'ELEMENT_DELETED'
  | 'ELEMENT_DUPLICATED'
  | 'TOOLBAR_ACTION'
  | 'DESIGN_SNAPSHOT';

export interface BridgeMessage<T = unknown> {
  source: 'voltron-host' | 'voltron-iframe';
  type: OutboundMessageType | InboundMessageType;
  payload: T;
  timestamp: number;
  id: string;
}

export interface ElementSelectedPayload {
  selector: string;
  tagName: string;
  id: string;
  classList: string[];
  computedStyles: Record<string, string>;
  bounds: { x: number; y: number; width: number; height: number };
  textContent: string;
  attributes: Record<string, string>;
  parentSelector: string | null;
  childCount: number;
  elementPath: string[];
}

export interface DomMutatedPayload {
  mutations: Array<{
    type: string;
    target: string;
    addedNodes: number;
    removedNodes: number;
    attributeName?: string;
    oldValue?: string;
    newValue?: string;
  }>;
}

export interface StyleAppliedPayload {
  selector: string;
  property: string;
  value: string;
  success: boolean;
}

export interface LayoutAppliedPayload {
  selector: string;
  bounds: { x: number; y: number; width: number; height: number };
  success: boolean;
}

export interface StateSnapshotPayload {
  html: string;
  styles: Record<string, Record<string, string>>;
  viewport: { width: number; height: number };
}

export interface ElementMovedPayload {
  selector: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  deltaX: number;
  deltaY: number;
}

export interface ElementAddedPayload {
  selector: string;
  tagName: string;
  parentSelector: string;
  html: string;
}

export interface ElementDeletedPayload {
  selector: string;
  outerHTML: string;
  parentSelector: string;
  indexInParent: number;
}

export interface ElementDuplicatedPayload {
  originalSelector: string;
  newSelector: string;
  html: string;
}

export interface ToolbarActionPayload {
  action: 'move' | 'duplicate' | 'delete';
  selector: string;
}

export interface DesignSnapshotPayload {
  addedElements: Array<{ selector: string; html: string; parentSelector: string }>;
  deletedElements: Array<{ selector: string; outerHTML: string; parentSelector: string }>;
  movedElements: Array<{ selector: string; deltaX: number; deltaY: number }>;
  styleChanges: Array<{ selector: string; property: string; oldValue: string; newValue: string }>;
  timestamp: number;
}

export interface AddElementConfig {
  tagName: string;
  parentSelector: string;
  position: 'append' | 'prepend' | 'before' | 'after';
  attributes?: Record<string, string>;
  styles?: Record<string, string>;
  textContent?: string;
  innerHTML?: string;
}

export type MessageCallback = (msg: BridgeMessage) => void;

let messageIdCounter = 0;

export class SandboxBridge {
  private iframe: HTMLIFrameElement | null = null;
  private allowedOrigins: Set<string>;
  private listeners: Map<InboundMessageType | '*', Set<MessageCallback>> = new Map();
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private _isConnected = false;

  constructor(allowedOrigins: string[] = ['*']) {
    this.allowedOrigins = new Set(allowedOrigins);
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Attach the bridge to an iframe element.
   */
  attach(iframe: HTMLIFrameElement): void {
    this.detach();
    this.iframe = iframe;

    this.messageHandler = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    window.addEventListener('message', this.messageHandler);
  }

  /**
   * Detach from the iframe and clean up listeners.
   */
  detach(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.iframe = null;
    this._isConnected = false;
  }

  /**
   * Send a message to the iframe.
   */
  sendToIframe<T = unknown>(type: OutboundMessageType, payload: T): void {
    if (!this.iframe?.contentWindow) {
      console.warn('[SandboxBridge] No iframe attached or contentWindow not available');
      return;
    }

    const message: BridgeMessage<T> = {
      source: 'voltron-host',
      type,
      payload,
      timestamp: Date.now(),
      id: `msg_${messageIdCounter++}`,
    };

    this.iframe.contentWindow.postMessage(message, '*');
  }

  /**
   * Register a callback for incoming messages of a specific type.
   * Use '*' to listen to all message types.
   */
  onMessage(type: InboundMessageType | '*', callback: MessageCallback): () => void {
    let typeSet = this.listeners.get(type);
    if (!typeSet) {
      typeSet = new Set();
      this.listeners.set(type, typeSet);
    }
    typeSet.add(callback);

    // Return unsubscribe function
    return () => {
      typeSet?.delete(callback);
      if (typeSet?.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  /**
   * Handle incoming messages from the iframe.
   */
  private handleMessage(event: MessageEvent): void {
    // Origin validation
    if (this.allowedOrigins.size > 0 && !this.allowedOrigins.has('*')) {
      if (!this.allowedOrigins.has(event.origin)) {
        return;
      }
    }

    const data = event.data as BridgeMessage;

    // Validate message structure
    if (!data || data.source !== 'voltron-iframe' || !data.type) {
      return;
    }

    // Track connection status
    if (data.type === 'BRIDGE_READY') {
      this._isConnected = true;
    }

    // Notify specific type listeners
    const typeListeners = this.listeners.get(data.type as InboundMessageType);
    if (typeListeners) {
      for (const cb of typeListeners) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[SandboxBridge] Listener error for ${data.type}:`, err);
        }
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      for (const cb of wildcardListeners) {
        try {
          cb(data);
        } catch (err) {
          console.error('[SandboxBridge] Wildcard listener error:', err);
        }
      }
    }
  }

  // ── Convenience Methods ──────────────────────────────

  /**
   * Inject CSS into the iframe.
   */
  injectStyles(selector: string, property: string, value: string): void {
    this.sendToIframe('INJECT_STYLES', { selector, property, value });
  }

  /**
   * Update layout of an element.
   */
  updateLayout(selector: string, changes: Partial<{ width: string; height: string; top: string; left: string; position: string }>): void {
    this.sendToIframe('UPDATE_LAYOUT', { selector, changes });
  }

  /**
   * Update element props/attributes.
   */
  updateProps(selector: string, attributes: Record<string, string>): void {
    this.sendToIframe('UPDATE_PROPS', { selector, attributes });
  }

  /**
   * Request a full state snapshot from the iframe.
   */
  requestSnapshot(): void {
    this.sendToIframe('REQUEST_SNAPSHOT', {});
  }

  /**
   * Trigger element selection mode in the iframe.
   */
  selectElement(enabled: boolean): void {
    this.sendToIframe('SELECT_ELEMENT', { enabled });
  }

  /**
   * Enable/disable drag mode in the iframe.
   */
  enableDragMode(enabled: boolean): void {
    this.sendToIframe('ENABLE_DRAG_MODE', { enabled });
  }

  /**
   * Add a new element to the iframe DOM.
   */
  addElement(config: AddElementConfig): void {
    this.sendToIframe('ADD_ELEMENT', config);
  }

  /**
   * Delete an element from the iframe DOM.
   */
  deleteElement(selector: string): void {
    this.sendToIframe('DELETE_ELEMENT', { selector });
  }

  /**
   * Duplicate an element in the iframe DOM.
   */
  duplicateElement(selector: string): void {
    this.sendToIframe('DUPLICATE_ELEMENT', { selector });
  }

  /**
   * Show/hide the floating toolbar on a selected element.
   */
  showElementToolbar(selector: string | null): void {
    this.sendToIframe('SHOW_ELEMENT_TOOLBAR', { selector });
  }

  /**
   * Request a design snapshot (all human changes since last snapshot).
   */
  requestDesignSnapshot(): void {
    this.sendToIframe('REQUEST_DESIGN_SNAPSHOT', {});
  }

  /**
   * Destroy the bridge and clean up all resources.
   */
  destroy(): void {
    this.detach();
    this.listeners.clear();
  }
}
