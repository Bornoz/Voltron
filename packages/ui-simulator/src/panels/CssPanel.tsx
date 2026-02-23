import { useState, useCallback, useMemo } from 'react';
import { Paintbrush, Search, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { useSimulatorStore } from '../stores/simulatorStore';
import { useStyleSync } from '../hooks/useStyleSync';
import { CSS_PROPERTY_GROUPS, isColorProperty } from '../utils/css-parser';
import { cssToTailwind } from '../utils/tailwind-mapper';
import { ColorPicker } from './ColorPicker';
import { EyedropperTool } from './EyedropperTool';
import type { SandboxBridge } from '../sandbox/SandboxBridge';

interface CssPanelProps {
  bridge: SandboxBridge;
}

export function CssPanel({ bridge }: CssPanelProps) {
  const selectedElement = useSimulatorStore((s) => s.selectedElement);
  const { updateStyle } = useStyleSync(bridge);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['Typography', 'Background', 'Spacing', 'Size']),
  );
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [editingProp, setEditingProp] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [copiedProp, setCopiedProp] = useState<string | null>(null);

  const computedStyles = selectedElement?.computedStyles ?? {};

  // Filter properties by search
  const filteredGroups = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const [group, props] of Object.entries(CSS_PROPERTY_GROUPS)) {
      const filtered = props.filter(
        (p) =>
          !searchTerm ||
          p.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (computedStyles[p] ?? '').toLowerCase().includes(searchTerm.toLowerCase()),
      );
      if (filtered.length > 0) {
        result[group] = filtered;
      }
    }
    return result;
  }, [searchTerm, computedStyles]);

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }, []);

  const handleStartEdit = useCallback((property: string) => {
    setEditingProp(property);
    setEditValue(computedStyles[property] ?? '');
  }, [computedStyles]);

  const handleFinishEdit = useCallback(
    (property: string) => {
      if (editValue !== computedStyles[property]) {
        updateStyle(property, editValue);
      }
      setEditingProp(null);
    },
    [editValue, computedStyles, updateStyle],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, property: string) => {
      if (e.key === 'Enter') {
        handleFinishEdit(property);
      } else if (e.key === 'Escape') {
        setEditingProp(null);
      }
    },
    [handleFinishEdit],
  );

  const handleCopyValue = useCallback((property: string) => {
    const value = computedStyles[property] ?? '';
    navigator.clipboard.writeText(`${property}: ${value}`).then(() => {
      setCopiedProp(property);
      setTimeout(() => setCopiedProp(null), 1500);
    });
  }, [computedStyles]);

  if (!selectedElement) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3 p-4">
        <Paintbrush className="w-10 h-10 text-gray-600" />
        <p className="text-sm text-center">Select an element in the preview to edit its CSS properties.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <Paintbrush className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-gray-200">CSS Properties</span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search properties..."
            className="w-full pl-7 pr-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Eyedropper */}
      <div className="px-3 py-2 border-b border-gray-700">
        <EyedropperTool
          bridge={bridge}
          onColorPicked={(color) => {
            // If a color property is being edited, apply the picked color
            if (editingProp && isColorProperty(editingProp)) {
              updateStyle(editingProp, color);
            }
          }}
        />
      </div>

      {/* Property Groups */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(filteredGroups).map(([group, properties]) => (
          <div key={group} className="border-b border-gray-800">
            <button
              onClick={() => toggleGroup(group)}
              className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-800/50 transition-colors"
            >
              {expandedGroups.has(group) ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              )}
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {group}
              </span>
              <span className="text-xs text-gray-600">({properties.length})</span>
            </button>

            {expandedGroups.has(group) && (
              <div className="px-2 pb-2">
                {properties.map((property) => {
                  const value = computedStyles[property] ?? '';
                  const isColor = isColorProperty(property);
                  const isEditing = editingProp === property;
                  const twClass = cssToTailwind(property, value);

                  return (
                    <div
                      key={property}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800/50 group"
                    >
                      {/* Property name */}
                      <span className="text-xs font-mono text-gray-400 w-32 shrink-0 truncate">
                        {property}
                      </span>

                      {/* Color swatch */}
                      {isColor && value && (
                        <div className="relative">
                          <button
                            onClick={() =>
                              setActiveColorPicker(
                                activeColorPicker === property ? null : property,
                              )
                            }
                            className="color-swatch shrink-0"
                            style={{ backgroundColor: value }}
                            title="Open color picker"
                          />
                          {activeColorPicker === property && (
                            <div className="absolute top-8 left-0 z-50">
                              <ColorPicker
                                value={value}
                                onChange={(color) => updateStyle(property, color)}
                                onClose={() => setActiveColorPicker(null)}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Value */}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleFinishEdit(property)}
                            onKeyDown={(e) => handleKeyDown(e, property)}
                            autoFocus
                            className="w-full px-1 py-0.5 bg-gray-900 border border-blue-500 rounded text-xs font-mono text-gray-200 focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => handleStartEdit(property)}
                            className="w-full text-left px-1 py-0.5 text-xs font-mono text-gray-300 truncate hover:text-white transition-colors"
                            title={value}
                          >
                            {value || <span className="text-gray-600 italic">empty</span>}
                          </button>
                        )}
                      </div>

                      {/* Tailwind class hint */}
                      {twClass && !isEditing && (
                        <span className="text-[10px] text-blue-400/70 shrink-0 font-mono">
                          {twClass}
                        </span>
                      )}

                      {/* Copy button */}
                      <button
                        onClick={() => handleCopyValue(property)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title="Copy"
                      >
                        {copiedProp === property ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-500 hover:text-gray-300" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
