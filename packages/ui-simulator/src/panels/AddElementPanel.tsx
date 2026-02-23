import { useState } from 'react';
import {
  Type, Square, Heading1, Heading2, Heading3,
  MousePointerClick, TextCursorInput, Link, ImageIcon,
  AlignVerticalJustifyStart, AlignVerticalJustifyEnd,
  ArrowUpToLine, ArrowDownToLine,
} from 'lucide-react';
import { useSimulatorStore } from '../stores/simulatorStore';
import type { SandboxBridge, AddElementConfig } from '../sandbox/SandboxBridge';

interface AddElementPanelProps {
  bridge: SandboxBridge;
}

interface ElementTemplate {
  label: string;
  tagName: string;
  icon: React.ElementType;
  category: string;
  defaultStyles?: Record<string, string>;
  defaultAttributes?: Record<string, string>;
  defaultText?: string;
}

const ELEMENT_TEMPLATES: ElementTemplate[] = [
  // Basic
  { label: 'Div', tagName: 'div', icon: Square, category: 'Basic', defaultStyles: { padding: '16px', 'background-color': '#f3f4f6', 'border-radius': '8px' }, defaultText: 'New div' },
  { label: 'Paragraph', tagName: 'p', icon: Type, category: 'Basic', defaultText: 'New paragraph text' },
  { label: 'Span', tagName: 'span', icon: Type, category: 'Basic', defaultStyles: { padding: '4px 8px', 'background-color': '#e5e7eb', 'border-radius': '4px' }, defaultText: 'Span' },

  // Headings
  { label: 'H1', tagName: 'h1', icon: Heading1, category: 'Headings', defaultText: 'Heading 1' },
  { label: 'H2', tagName: 'h2', icon: Heading2, category: 'Headings', defaultText: 'Heading 2' },
  { label: 'H3', tagName: 'h3', icon: Heading3, category: 'Headings', defaultText: 'Heading 3' },

  // Interactive
  { label: 'Button', tagName: 'button', icon: MousePointerClick, category: 'Interactive', defaultStyles: { padding: '8px 16px', 'background-color': '#6366f1', color: '#ffffff', 'border-radius': '6px', border: 'none', cursor: 'pointer', 'font-weight': '500' }, defaultText: 'Button' },
  { label: 'Input', tagName: 'input', icon: TextCursorInput, category: 'Interactive', defaultStyles: { padding: '8px 12px', border: '1px solid #d1d5db', 'border-radius': '6px', width: '200px' }, defaultAttributes: { type: 'text', placeholder: 'Enter text...' } },
  { label: 'Link', tagName: 'a', icon: Link, category: 'Interactive', defaultStyles: { color: '#6366f1', 'text-decoration': 'underline', cursor: 'pointer' }, defaultAttributes: { href: '#' }, defaultText: 'Link text' },

  // Media
  { label: 'Image', tagName: 'img', icon: ImageIcon, category: 'Media', defaultStyles: { width: '200px', height: '150px', 'object-fit': 'cover', 'border-radius': '8px', 'background-color': '#e5e7eb' }, defaultAttributes: { src: 'https://placehold.co/200x150', alt: 'Placeholder' } },
];

const CATEGORIES = ['Basic', 'Headings', 'Interactive', 'Media'];

type InsertPosition = 'append' | 'prepend' | 'before' | 'after';

const POSITION_OPTIONS: { value: InsertPosition; label: string; icon: React.ElementType }[] = [
  { value: 'append', label: 'Append', icon: ArrowDownToLine },
  { value: 'prepend', label: 'Prepend', icon: ArrowUpToLine },
  { value: 'before', label: 'Before', icon: AlignVerticalJustifyStart },
  { value: 'after', label: 'After', icon: AlignVerticalJustifyEnd },
];

export function AddElementPanel({ bridge }: AddElementPanelProps) {
  const selectedElement = useSimulatorStore((s) => s.selectedElement);
  const [insertPosition, setInsertPosition] = useState<InsertPosition>('append');

  const parentSelector = selectedElement?.selector || 'body';

  const handleAddElement = (template: ElementTemplate) => {
    const config: AddElementConfig = {
      tagName: template.tagName,
      parentSelector,
      position: insertPosition,
      attributes: template.defaultAttributes,
      styles: template.defaultStyles,
      textContent: template.defaultText,
    };
    bridge.addElement(config);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-4">
      {/* Insert position */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">
          Insert Position
        </label>
        <div className="grid grid-cols-4 gap-1">
          {POSITION_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setInsertPosition(value)}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded text-[10px] transition-colors ${
                insertPosition === value
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                  : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300 border border-transparent'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Target */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">
          Target
        </label>
        <div className="text-xs text-gray-300 font-mono bg-gray-800/50 rounded px-2 py-1 truncate">
          {parentSelector}
        </div>
      </div>

      {/* Element templates by category */}
      {CATEGORIES.map((category) => {
        const templates = ELEMENT_TEMPLATES.filter((t) => t.category === category);
        return (
          <div key={category}>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">
              {category}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {templates.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.label}
                    onClick={() => handleAddElement(template)}
                    className="flex flex-col items-center gap-1 py-2 px-1 rounded border border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-gray-200 hover:border-purple-500/30 transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px]">{template.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
