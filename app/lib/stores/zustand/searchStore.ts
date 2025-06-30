import create from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface ProjectSearchResultMatch {
  lineNumber: number;
  lineContent: string;
  matchPosition?: { start: number; length: number }[]; // For highlighting
}

export interface ProjectSearchResultItem {
  filePath: string;
  fileName: string; // For easier display
  matches: ProjectSearchResultMatch[]; // Content matches
  isFileNameMatch?: boolean; // If the file name itself matched
}

export interface SearchOptions {
  caseSensitive: boolean;
  useRegex: boolean;
  // includePatterns: string[]; // glob patterns
  // excludePatterns: string[]; // glob patterns
}

interface AdvancedSearchState {
  isOpen: boolean; // If it's a modal
  searchQuery: string;
  searchScope: 'project' | 'web';
  projectResults: ProjectSearchResultItem[];
  isLoading: boolean;
  searchOptions: SearchOptions;
  actions: {
    toggleSearch: (open?: boolean) => void;
    setSearchQuery: (query: string) => void;
    setSearchScope: (scope: 'project' | 'web') => void;
    performSearch: () => Promise<void>; // This will trigger the actual search logic
    setSearchOptions: (options: Partial<SearchOptions>) => void;
    clearResults: () => void;
  };
  // Internal helpers / data sources - these would be set by other parts of the app
  // This is a simplified way; ideally, this store would subscribe to file changes from Yjs/fileStore
  _fileProvider: {
    getAllFiles: () => Promise<Array<{ path: string; content?: () => Promise<string>}>>; // path and optional content getter
  } | null;
  setFileProvider: (provider: AdvancedSearchState['_fileProvider']) => void;
}

export const useAdvancedSearchStore = create<AdvancedSearchState>()(
  immer((set, get) => ({
    isOpen: false,
    searchQuery: '',
    searchScope: 'project',
    projectResults: [],
    isLoading: false,
    searchOptions: {
      caseSensitive: false,
      useRegex: false,
    },
    _fileProvider: null, // To be injected from where file data is managed (e.g., Yjs store)

    actions: {
      toggleSearch: (open?: boolean) =>
        set((state) => {
          state.isOpen = open !== undefined ? open : !state.isOpen;
          if (!state.isOpen) {
            state.searchQuery = '';
            state.projectResults = [];
          }
        }),
      setSearchQuery: (query: string) =>
        set((state) => {
          state.searchQuery = query;
        }),
      setSearchScope: (scope: 'project' | 'web') =>
        set((state) => {
          state.searchScope = scope;
          state.projectResults = []; // Clear results when changing scope
        }),
      setSearchOptions: (options: Partial<SearchOptions>) =>
        set((state) => {
          state.searchOptions = { ...state.searchOptions, ...options };
        }),
      clearResults: () => set(state => { state.projectResults = []; }),
      performSearch: async () => {
        const { searchQuery, searchScope, searchOptions, _fileProvider } = get();
        if (!searchQuery.trim()) {
          set({ projectResults: [], isLoading: false });
          return;
        }

        set({ isLoading: true });

        if (searchScope === 'web') {
          // Open in new tab
          window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank');
          // Or use other search engines based on settings
          set({ isLoading: false });
          // Optionally close the search UI if it's a modal
          // get().actions.toggleSearch(false);
          return;
        }

        // Project Search
        if (!_fileProvider) {
          console.warn('File provider not set for project search.');
          set({ projectResults: [], isLoading: false });
          return;
        }

        const results: ProjectSearchResultItem[] = [];
        try {
          const allFiles = await _fileProvider.getAllFiles();
          const query = searchOptions.caseSensitive ? searchQuery : searchQuery.toLowerCase();

          for (const file of allFiles) {
            const filePath = file.path;
            const fileName = filePath.split('/').pop() || filePath;
            let fileMatches: ProjectSearchResultItem | null = null;

            // Check filename
            const normalizedFileName = searchOptions.caseSensitive ? fileName : fileName.toLowerCase();
            if (normalizedFileName.includes(query)) { // Simple includes for filename
              fileMatches = { filePath, fileName, matches: [], isFileNameMatch: true };
            }

            // Check content (if content getter exists)
            // This is a very basic content search. For large files or many files, this will be slow.
            // A backend search (ripgrep) or WebAssembly-based client search would be better.
            if (file.content) {
              const content = await file.content();
              const lines = content.split('\n');
              const contentMatches: ProjectSearchResultMatch[] = [];

              lines.forEach((lineContent, index) => {
                const normalizedLine = searchOptions.caseSensitive ? lineContent : lineContent.toLowerCase();
                if (normalizedLine.includes(query)) { // Simple includes for content line
                  contentMatches.push({
                    lineNumber: index + 1,
                    lineContent: lineContent, // Keep original case for display
                  });
                }
              });

              if (contentMatches.length > 0) {
                if (!fileMatches) {
                  fileMatches = { filePath, fileName, matches: [] };
                }
                fileMatches.matches.push(...contentMatches);
              }
            }

            if (fileMatches && (fileMatches.isFileNameMatch || fileMatches.matches.length > 0)) {
              results.push(fileMatches);
            }
          }
        } catch (error) {
          console.error("Error during project search:", error);
        } finally {
          set({ projectResults: results, isLoading: false });
        }
      },
      setFileProvider: (provider) => set(state => { state._fileProvider = provider; }),
    },
  }))
);

// How to use fileProvider:
// Somewhere in your app where you manage Yjs docs or file state:
// const { setFileProvider } = useAdvancedSearchStore.getState().actions;
// setFileProvider({
//   getAllFiles: async () => {
//     // This function should return a list of all files in the project
//     // Each file object should have a `path` (string)
//     // and an optional `content` (async function returning string) for content search.
//     // Example:
//     // return yDoc.getMap('files').toJSON().map(fileData => ({
//     //   path: fileData.path,
//     //   content: async () => yDoc.getText(fileData.yTextName).toString()
//     // }));
//     return [{ path: 'example/file1.txt', content: async () => 'Hello World' }, { path: 'example/file2.js', content: async () => 'console.log("Hello")'}];
//   }
// });
