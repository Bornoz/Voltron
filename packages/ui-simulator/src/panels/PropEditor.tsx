import { useState, useCallback } from 'react';
import { Code2, Plus, Trash2, Save } from 'lucide-react';
import { useSimulatorStore } from '../stores/simulatorStore';
import { useHistoryStore, createHistoryEntry } from '../stores/historyStore';
import type { SandboxBridge } from '../sandbox/SandboxBridge';

interface PropEditorProps {
  bridge: SandboxBridge;
}

interface AttributeRow {
  name: string;
  value: string;
  isNew?: boolean;
}

export function PropEditor({ bridge }: PropEditorProps) {
  const selectedElement = useSimulatorStore((s) => s.selectedElement);
  const pushHistory = useHistoryStore((s) => s.push);

  const [className, setClassName] = useState(selectedElement?.classList.join(' ') ?? '');
  const [textContent, setTextContent] = useState(selectedElement?.textContent ?? '');

  const initialDataAttrs = Object.entries(selectedElement?.attributes ?? {})
    .filter(([name]) => name.startsWith('data-'))
    .map(([name, value]) => ({ name, value }));

  const [dataAttributes, setDataAttributes] = useState<AttributeRow[]>(
    initialDataAttrs.length > 0 ? initialDataAttrs : [],
  );

  const regularAttributes = Object.entries(selectedElement?.attributes ?? {})
    .filter(
      ([name]) =>
        !name.startsWith('data-') &&
        name !== 'class' &&
        name !== 'id' &&
        name !== 'style',
    );

  const handleAddDataAttr = useCallback(() => {
    setDataAttributes((prev) => [...prev, { name: 'data-', value: '', isNew: true }]);
  }, []);

  const handleRemoveDataAttr = useCallback((index: number) => {
    setDataAttributes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDataAttrChange = useCallback(
    (index: number, field: 'name' | 'value', val: string) => {
      setDataAttributes((prev) =>
        prev.map((attr, i) => (i === index ? { ...attr, [field]: val } : attr)),
      );
    },
    [],
  );

  const handleApply = useCallback(() => {
    if (!selectedElement) return;

    const selector = selectedElement.selector;
    const attributes: Record<string, string> = {};
    const prevAttributes: Record<string, string> = {};

    // className
    const oldClass = selectedElement.classList.join(' ');
    if (className !== oldClass) {
      attributes['class'] = className;
      prevAttributes['class'] = oldClass;
    }

    // textContent
    if (textContent !== selectedElement.textContent) {
      attributes['textContent'] = textContent;
      prevAttributes['textContent'] = selectedElement.textContent;
    }

    // data-* attributes
    for (const attr of dataAttributes) {
      if (attr.name && attr.name.startsWith('data-')) {
        const oldValue = selectedElement.attributes[attr.name] ?? '';
        if (attr.value !== oldValue) {
          attributes[attr.name] = attr.value;
          prevAttributes[attr.name] = oldValue;
        }
      }
    }

    if (Object.keys(attributes).length === 0) return;

    // Apply to iframe
    bridge.updateProps(selector, attributes);

    // Record in history
    pushHistory(
      createHistoryEntry(
        'prop',
        selector,
        `Property change (${Object.keys(attributes).length} attributes)`,
        {
          selector,
          changes: Object.entries(attributes).map(([property, value]) => ({
            property,
            value,
          })),
        },
        {
          selector,
          changes: Object.entries(prevAttributes).map(([property, value]) => ({
            property,
            value,
          })),
        },
      ),
    );
  }, [selectedElement, className, textContent, dataAttributes, bridge, pushHistory]);

  if (!selectedElement) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 p-4">
        <Code2 className="w-10 h-10 text-gray-600" />
        <p className="text-sm text-center">Select an element to edit its properties.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <Code2 className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-gray-200">Properties</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Element info */}
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-xs text-gray-400 mb-1">Element</div>
          <div className="font-mono text-sm text-blue-400">
            &lt;{selectedElement.tagName}
            {selectedElement.id && (
              <span className="text-green-400"> id="{selectedElement.id}"</span>
            )}
            &gt;
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {selectedElement.childCount} children
          </div>
        </div>

        {/* className editor */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Class
          </label>
          <textarea
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-gray-200 resize-none focus:outline-none focus:border-blue-500"
            placeholder="CSS classes..."
          />
        </div>

        {/* Text content */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Text Content
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-gray-200 resize-none focus:outline-none focus:border-blue-500"
            placeholder="Element text..."
          />
        </div>

        {/* Regular attributes (read-only display) */}
        {regularAttributes.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Attributes
            </span>
            <div className="space-y-1">
              {regularAttributes.map(([name, value]) => (
                <div
                  key={name}
                  className="flex items-center gap-2 px-2 py-1 bg-gray-800/30 rounded"
                >
                  <span className="text-xs font-mono text-purple-400 shrink-0">{name}</span>
                  <span className="text-xs text-gray-500">=</span>
                  <span className="text-xs font-mono text-gray-300 truncate">"{value}"</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* data-* attributes (editable) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Data Attributes
            </span>
            <button
              onClick={handleAddDataAttr}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          {dataAttributes.length === 0 ? (
            <p className="text-xs text-gray-600 italic">No data attributes</p>
          ) : (
            <div className="space-y-1">
              {dataAttributes.map((attr, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={attr.name}
                    onChange={(e) => handleDataAttrChange(i, 'name', e.target.value)}
                    placeholder="data-..."
                    className="flex-1 px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs text-gray-500">=</span>
                  <input
                    type="text"
                    value={attr.value}
                    onChange={(e) => handleDataAttrChange(i, 'value', e.target.value)}
                    placeholder="value"
                    className="flex-1 px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleRemoveDataAttr(i)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Apply button */}
        <button
          onClick={handleApply}
          className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
        >
          <Save className="w-4 h-4" />
          Apply Changes
        </button>
      </div>
    </div>
  );
}
