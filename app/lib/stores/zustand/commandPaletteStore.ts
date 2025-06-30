import create from 'zustand';
import { immer } from 'zustand/middleware/immer'; // Optional: for easier nested state updates

export interface Command {
  id: string;
  name: string;
  action: () => void;
  category?: string;
  icon?: React.ReactNode; // Or string for icon names
  shortcut?: string;
}

interface CommandPaletteState {
  isOpen: boolean;
  searchTerm: string;
  commands: Command[];
  filteredCommands: Command[];
  selectedCommandIndex: number; // -1 for no selection or based on list
  actions: {
    togglePalette: (open?: boolean) => void;
    setSearchTerm: (term: string) => void;
    registerCommand: (command: Command) => void;
    unregisterCommand: (commandId: string) => void;
    executeCommand: (commandId: string) => void;
    // For keyboard navigation
    selectNextCommand: () => void;
    selectPreviousCommand: () => void;
    resetSelection: () => void;
    executeSelectedCommand: () => void;
  };
}

// Basic fuzzy search (can be replaced with a more sophisticated library like fuse.js if needed)
const fuzzySearch = (term: string, text: string) => {
  const searchTerm = term.toLowerCase();
  const targetText = text.toLowerCase();
  let searchPosition = 0;
  for (let i = 0; i < targetText.length; i++) {
    if (targetText[i] === searchTerm[searchPosition]) {
      searchPosition++;
    }
    if (searchPosition === searchTerm.length) {
      return true;
    }
  }
  return false;
};

export const useCommandPaletteStore = create<CommandPaletteState>()(
  immer((set, get) => ({
    isOpen: false,
    searchTerm: '',
    commands: [],
    filteredCommands: [],
    selectedCommandIndex: 0, // Start with the first command selected
    actions: {
      togglePalette: (open?: boolean) =>
        set((state) => {
          state.isOpen = open !== undefined ? open : !state.isOpen;
          if (state.isOpen) {
            // When opening, reset search term and selection
            state.searchTerm = '';
            state.filteredCommands = state.commands; // Initially show all
            state.selectedCommandIndex = 0;
          }
        }),
      setSearchTerm: (term: string) =>
        set((state) => {
          state.searchTerm = term;
          if (!term) {
            state.filteredCommands = state.commands;
          } else {
            state.filteredCommands = state.commands.filter(
              (cmd) =>
                fuzzySearch(term, cmd.name) ||
                (cmd.category && fuzzySearch(term, cmd.category))
            );
          }
          state.selectedCommandIndex = 0; // Reset selection on new search
        }),
      registerCommand: (command: Command) =>
        set((state) => {
          // Avoid duplicate IDs
          if (!state.commands.find(c => c.id === command.id)) {
            state.commands.push(command);
            // Re-filter if palette is open and search term exists
            if (state.isOpen && state.searchTerm) {
              state.filteredCommands = state.commands.filter(
                (cmd) =>
                  fuzzySearch(state.searchTerm, cmd.name) ||
                  (cmd.category && fuzzySearch(state.searchTerm, cmd.category))
              );
            } else if (state.isOpen) {
              state.filteredCommands = state.commands;
            }
          }
        }),
      unregisterCommand: (commandId: string) =>
        set((state) => {
          state.commands = state.commands.filter((cmd) => cmd.id !== commandId);
          // Re-filter
           if (state.isOpen && state.searchTerm) {
            state.filteredCommands = state.commands.filter(
              (cmd) =>
                fuzzySearch(state.searchTerm, cmd.name) ||
                (cmd.category && fuzzySearch(state.searchTerm, cmd.category))
            );
          } else if (state.isOpen) {
            state.filteredCommands = state.commands;
          }
        }),
      executeCommand: (commandId: string) => {
        const command = get().commands.find((cmd) => cmd.id === commandId);
        if (command) {
          command.action();
          get().actions.togglePalette(false); // Close palette after execution
        }
      },
      selectNextCommand: () =>
        set((state) => {
          if (state.filteredCommands.length > 0) {
            state.selectedCommandIndex =
              (state.selectedCommandIndex + 1) % state.filteredCommands.length;
          }
        }),
      selectPreviousCommand: () =>
        set((state) => {
          if (state.filteredCommands.length > 0) {
            state.selectedCommandIndex =
              (state.selectedCommandIndex - 1 + state.filteredCommands.length) %
              state.filteredCommands.length;
          }
        }),
      resetSelection: () => set(state => { state.selectedCommandIndex = 0; }),
      executeSelectedCommand: () => {
        const { filteredCommands, selectedCommandIndex, actions } = get();
        if (filteredCommands.length > 0 && selectedCommandIndex >= 0 && selectedCommandIndex < filteredCommands.length) {
          const command = filteredCommands[selectedCommandIndex];
          actions.executeCommand(command.id);
        }
      }
    },
  }))
);

// Example of how to use actions from outside React components:
// import { useCommandPaletteStore } from './commandPaletteStore';
// const { togglePalette, registerCommand } = useCommandPaletteStore.getState().actions;
// registerCommand({ id: 'test', name: 'Test Command', action: () => console.log('Test executed') });
// togglePalette();
