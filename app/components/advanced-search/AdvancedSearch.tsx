import React, { useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { useAdvancedSearchStore, ProjectSearchResultItem } from '~/lib/stores/zustand/searchStore';
import { Input } from '~/components/ui/Input';
import { Button } from '~/components/ui/Button';
import { ScrollArea } from '~/components/ui/ScrollArea';
import { X as LucideX, Search as LucideSearch, FileText, Globe } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook'; // For Esc to close

// Basic styling (inline for brevity, should be moved to CSS or UnoCSS)
const dialogOverlayStyle: React.CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  position: 'fixed',
  inset: 0,
  zIndex: 60, // Higher than command palette
};

const dialogContentStyle: React.CSSProperties = {
  backgroundColor: 'white', // Adapt to theme
  borderRadius: '8px',
  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
  position: 'fixed',
  top: '15%',
  left: '50%',
  transform: 'translate(-50%, -15%)',
  width: '90vw',
  maxWidth: '640px', // Slightly wider for search results
  maxHeight: '70vh',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  zIndex: 61,
};

const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const tabTriggerStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  border: '1px solid transparent',
  borderBottomColor: isActive ? '#3b82f6' : 'transparent', // Adapt
  color: isActive ? '#3b82f6' : '#6b7280', // Adapt
  cursor: 'pointer',
  background: 'none',
  fontWeight: isActive ? '600' : 'normal',
});

const resultItemStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '4px',
  cursor: 'pointer',
  marginBottom: '4px',
  border: '1px solid #e5e7eb', // Adapt
};

const matchLineStyle: React.CSSProperties = {
  fontSize: '0.85em',
  color: '#4b5563', // Adapt
  paddingLeft: '16px',
  whiteSpace: 'pre-wrap', // Show whitespace correctly
  fontFamily: 'monospace',
};


const AdvancedSearch: React.FC = () => {
  const {
    isOpen,
    searchQuery,
    searchScope,
    projectResults,
    isLoading,
    // searchOptions, // For later use with checkboxes for caseSensitive, regex
    actions,
  } = useAdvancedSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useHotkeys('esc', () => actions.toggleSearch(false), { enabled: isOpen });

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      // Potentially clear previous search query or results if desired
      // actions.setSearchQuery(''); // Example: clear query on open
      // actions.clearResults();
    }
  }, [isOpen, actions]);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    actions.performSearch();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={actions.toggleSearch}>
      <Dialog.Portal>
        <Dialog.Overlay style={dialogOverlayStyle} />
        <Dialog.Content style={dialogContentStyle} onOpenAutoFocus={(e) => e.preventDefault()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Dialog.Title style={{ fontSize: '1.125rem', fontWeight: '600' }}>Advanced Search</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <LucideX size={20} color="#6b7280" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSearch} style={inputGroupStyle}>
            <Input
              ref={inputRef}
              type="text"
              placeholder="Enter your search query..."
              value={searchQuery}
              onChange={(e) => actions.setSearchQuery(e.target.value)}
              style={{ flexGrow: 1 }}
              aria-label="Search Query"
            />
            <Button type="submit" disabled={isLoading || !searchQuery.trim()}>
              <LucideSearch size={18} style={{ marginRight: '6px' }} />
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </form>

          <Tabs.Root value={searchScope} onValueChange={(value) => actions.setSearchScope(value as 'project' | 'web')}>
            <Tabs.List style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
              <Tabs.Trigger value="project" style={tabTriggerStyle(searchScope === 'project')}>
                <FileText size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> In Project
              </Tabs.Trigger>
              <Tabs.Trigger value="web" style={tabTriggerStyle(searchScope === 'web')}>
                <Globe size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> On The Web
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="project" style={{ paddingTop: '16px' }}>
              {isLoading && <p>Loading project results...</p>}
              {!isLoading && projectResults.length === 0 && searchQuery && (
                <p>No results found in project for "{searchQuery}".</p>
              )}
              {!isLoading && projectResults.length === 0 && !searchQuery && (
                <p>Enter a query to search in the project.</p>
              )}
              {!isLoading && projectResults.length > 0 && (
                <ScrollArea style={{ maxHeight: 'calc(70vh - 220px)' /* Adjust */ }}>
                  {projectResults.map((item, index) => (
                    <div key={index} style={resultItemStyle} onClick={() => {
                        // TODO: Implement action to open file, potentially scroll to line
                        // This would involve communication with the editor store/component
                        console.log('Open file:', item.filePath);
                        // Example: editorActions.openFile(item.filePath, { line: item.matches[0]?.lineNumber })
                        actions.toggleSearch(false); // Close search on click
                    }}>
                      <p style={{ fontWeight: '500' }}>{item.fileName}</p>
                      <p style={{ fontSize: '0.8em', color: '#6b7280' }}>{item.filePath}</p>
                      {item.isFileNameMatch && item.matches.length === 0 && (
                        <p style={matchLineStyle}><em>Filename match</em></p>
                      )}
                      {item.matches.map((match, matchIdx) => (
                        <div key={matchIdx} style={matchLineStyle}>
                          <span style={{ color: '#9ca3af', marginRight: '8px' }}>{match.lineNumber}:</span>
                          {match.lineContent}
                        </div>
                      ))}
                    </div>
                  ))}
                </ScrollArea>
              )}
            </Tabs.Content>
            <Tabs.Content value="web" style={{ paddingTop: '16px' }}>
              <p>Web search will open in a new tab when you click the "Search" button.</p>
              {searchQuery && (
                 <p style={{marginTop: '8px'}}>Click "Search" to search for "{searchQuery}" on the web.</p>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default AdvancedSearch;

// How to open this search modal:
// Typically from the Command Palette or a dedicated search icon/button.
// import { useAdvancedSearchStore } from '~/lib/stores/zustand/searchStore';
// const { toggleSearch } = useAdvancedSearchStore.getState().actions;
// toggleSearch(true);
//
// And setting up the file provider (needs to be done once, e.g. when Yjs is initialized):
// import { useAdvancedSearchStore } from '~/lib/stores/zustand/searchStore';
// import { yjsDoc, getYjsFileContent } from '~/lib/yjs'; // hypothetical yjs setup
//
// function setupGlobalStores() {
//   const searchActions = useAdvancedSearchStore.getState().actions;
//   searchActions.setFileProvider({
//     getAllFiles: async () => {
//       // Replace with actual logic to get all file paths and content getters from Yjs
//       const filesFromYjs = []; // e.g., iterate yjsDoc.getMap('files')
//       // for (const [path, meta] of yjsDoc.getMap('files').entries()) {
//       //   filesFromYjs.push({ path, content: async () => getYjsFileContent(path) });
//       // }
//       return filesFromYjs;
//     }
//   });
// }
// setupGlobalStores();
