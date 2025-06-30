import React, { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useCommandPaletteStore, Command } from '~/lib/stores/zustand/commandPaletteStore';
import { Input } from '~/components/ui/Input'; // Assuming Input component exists and is styled
import { ScrollArea } from '~/components/ui/ScrollArea'; // Assuming ScrollArea exists
import { X as LucideX, Search as LucideSearch } from 'lucide-react'; // Icons
import { useHotkeys } from 'react-hotkeys-hook';

// Basic styling (inline for brevity, should be moved to CSS modules or UnoCSS)
const dialogOverlayStyle: React.CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  position: 'fixed',
  inset: 0,
  zIndex: 50, // Ensure it's above other content
};

const dialogContentStyle: React.CSSProperties = {
  backgroundColor: 'white', // Adapt to theme
  borderRadius: '8px',
  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
  position: 'fixed',
  top: '20%',
  left: '50%',
  transform: 'translate(-50%, -20%)',
  width: '90vw',
  maxWidth: '560px',
  maxHeight: '70vh',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  zIndex: 51,
};

const inputWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  borderBottom: '1px solid #e5e7eb', // Adapt to theme
  paddingBottom: '8px',
};

const commandItemStyle = (isSelected: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  borderRadius: '4px',
  cursor: 'pointer',
  backgroundColor: isSelected ? '#f3f4f6' : 'transparent', // Adapt to theme
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const CommandPalette: React.FC = () => {
  const { isOpen, searchTerm, filteredCommands, selectedCommandIndex, actions } = useCommandPaletteStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useHotkeys('esc', () => actions.togglePalette(false), { enabled: isOpen });
  useHotkeys('enter', (e) => {
    if (isOpen) {
      e.preventDefault();
      actions.executeSelectedCommand();
    }
  }, { enabled: isOpen });
  useHotkeys('arrowdown', (e) => {
     if (isOpen) {
      e.preventDefault();
      actions.selectNextCommand();
     }
  }, { enabled: isOpen });
  useHotkeys('arrowup', (e) => {
    if (isOpen) {
      e.preventDefault();
      actions.selectPreviousCommand();
    }
  }, { enabled: isOpen });


  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      actions.resetSelection(); // Reset selection when opening
    }
  }, [isOpen, actions]);

  // Scroll into view for selected command
  const selectedItemRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isOpen && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedCommandIndex, isOpen]);


  if (!isOpen) {
    return null;
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={actions.togglePalette}>
      <Dialog.Portal>
        <Dialog.Overlay style={dialogOverlayStyle} />
        <Dialog.Content style={dialogContentStyle} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div style={inputWrapperStyle}>
            <LucideSearch size={20} color="#6b7280" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Type a command or search..."
              value={searchTerm}
              onChange={(e) => actions.setSearchTerm(e.target.value)}
              style={{ border: 'none', outline: 'none', flexGrow: 1, fontSize: '1rem' }}
            />
            <Dialog.Close asChild>
              <button aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <LucideX size={20} color="#6b7280" />
              </button>
            </Dialog.Close>
          </div>

          <ScrollArea style={{ flexGrow: 1, maxHeight: 'calc(70vh - 100px)' /* Adjust based on padding/input height */ }}>
            {filteredCommands.length === 0 && searchTerm && (
              <p style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>No commands found.</p>
            )}
            {filteredCommands.map((command, index) => (
              <div
                key={command.id}
                ref={index === selectedCommandIndex ? selectedItemRef : null}
                style={commandItemStyle(index === selectedCommandIndex)}
                onClick={() => actions.executeCommand(command.id)}
                onMouseEnter={() => actions.selectedCommandIndex = index} // Simple mouse hover selection
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {command.icon}
                  <span>{command.name}</span>
                </div>
                {command.shortcut && (
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{command.shortcut}</span>
                )}
              </div>
            ))}
          </ScrollArea>
          {/* Optional: Footer for branding or tips */}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CommandPalette;

// Global hotkey to open the palette (should be placed in a higher-order component like root.tsx or main layout)
// Example:
// import { useHotkeys } from 'react-hotkeys-hook';
// import { useCommandPaletteStore } from '~/lib/stores/zustand/commandPaletteStore';
//
// const AppLayout = () => {
//   const { togglePalette } = useCommandPaletteStore.getState().actions;
//   useHotkeys('mod+shift+p', (e) => {
//      e.preventDefault();
//      togglePalette();
//   }, { preventDefault: true });
//   return <>{/* children */}</>;
// }
