import React, { useRef, useEffect, memo, useState } from 'react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { editor } from 'monaco-editor/esm/vs/editor/editor.api';
import { useStore } from '@nanostores/react';
import { themeStore, type Theme } from '~/lib/stores/theme';
import { WORK_DIR } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';
import { isMobile } from '~/utils/mobile';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { WebrtcProvider } from 'y-webrtc'; // Using WebRTC for simplicity, can be replaced with WebSocket

const logger = createScopedLogger('MonacoEditor');

// Simple helper for file path to language mapping
const getLanguageForFilePath = (filePath: string): string => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'py':
      return 'python';
    case 'md':
      return 'markdown';
    // Add more mappings as needed
    default:
      return 'plaintext';
  }
};


export interface EditorDocument {
  value: string;
  isBinary: boolean;
  filePath: string;
  scroll?: ScrollPosition;
}

export interface EditorSettings {
  fontSize?: number; // Monaco uses numbers for font size
  tabSize?: number;
}

export interface ScrollPosition {
  scrollTop?: number;
  scrollLeft?: number;
}

export interface EditorUpdate {
  selection: monaco.Selection | null; // Monaco's selection type
  content: string;
}

export type OnChangeCallback = (update: EditorUpdate) => void;
export type OnScrollCallback = (position: ScrollPosition) => void;
export type OnSaveCallback = () => void;

interface Props {
  theme: Theme; // Assuming Theme is 'dark' | 'light' or similar
  id?: unknown;
  doc?: EditorDocument;
  editable?: boolean;
  debounceChange?: number;
  debounceScroll?: number;
  autoFocusOnDocumentChange?: boolean;
  onChange?: OnChangeCallback;
  onScroll?: OnScrollCallback;
  onSave?: OnSaveCallback;
  className?: string;
  settings?: EditorSettings;
}

const MonacoEditorComponent: React.FC<Props> = memo(
  ({
    doc,
    editable = true,
    autoFocusOnDocumentChange = false,
    onChange,
    onScroll,
    onSave,
    theme,
    settings,
    className = '',
  }) => {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);
    const providerRef = useRef<WebrtcProvider | null>(null);
    const bindingRef = useRef<MonacoBinding | null>(null);
    const [isCollabReady, setIsCollabReady] = useState(false);

    // Use refs for props that might change to avoid re-triggering useEffects unnecessarily
    const currentDocRef = useRef<EditorDocument | undefined>(doc);
    const currentThemeRef = useRef<Theme>(theme);
    const currentSettingsRef = useRef<EditorSettings | undefined>(settings);
    const onChangeRef = useRef(onChange);
    const onScrollRef = useRef(onScroll);
    const onSaveRef = useRef(onSave);

    useEffect(() => {
      currentDocRef.current = doc;
      currentThemeRef.current = theme;
      currentSettingsRef.current = settings;
      onChangeRef.current = onChange;
      onScrollRef.current = onScroll;
      onSaveRef.current = onSave;
    });

    useEffect(() => {
      if (containerRef.current && !editorRef.current) {
        const initialValue = currentDocRef.current?.value || '';
        const initialLanguage = currentDocRef.current ? getLanguageForFilePath(currentDocRef.current.filePath) : 'plaintext';

        const editorInstance = monaco.editor.create(containerRef.current, {
          value: initialValue, // Initial value, Yjs will take over if collab is enabled
          language: initialLanguage,
          theme: currentThemeRef.current === 'dark' ? 'vs-dark' : 'vs',
          readOnly: !editable || currentDocRef.current?.isBinary,
          fontSize: currentSettingsRef.current?.fontSize,
          tabSize: currentSettingsRef.current?.tabSize,
          automaticLayout: true,
        });
        editorRef.current = editorInstance;

        // Handle scroll changes
        editorInstance.onDidScrollChange((e) => {
          if (onScrollRef.current && (e.scrollTopChanged || e.scrollLeftChanged)) {
            onScrollRef.current({ scrollTop: e.scrollTop, scrollLeft: e.scrollLeft });
          }
        });

        // Handle save command
        editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          if (onSaveRef.current) {
            onSaveRef.current();
          }
        });
      }

      // Yjs setup effect
      if (editorRef.current && currentDocRef.current && !currentDocRef.current.isBinary && !ydocRef.current) {
        logger.debug(`Setting up Yjs for: ${currentDocRef.current.filePath}`);
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        // For simplicity, using WebRTC provider. Replace with WebSocketProvider for a custom backend.
        // Room name could be derived from filePath or a unique document ID.
        const roomName = `monaco-yjs-demo-${currentDocRef.current.filePath.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        try {
          const provider = new WebrtcProvider(roomName, ydoc);
          providerRef.current = provider;

          const yText = ydoc.getText('monaco');
          const model = editorRef.current.getModel();

          if (model) {
            // Check if yText is empty and model is not, to initialize yText from model
            if (yText.length === 0 && model.getValueLength() > 0) {
                yText.insert(0, model.getValue());
            }

            const binding = new MonacoBinding(yText, model, new Set([editorRef.current]), provider.awareness);
            bindingRef.current = binding;
            setIsCollabReady(true); // Indicate that Yjs setup is complete
            logger.info(`Yjs collaboration started for room: ${roomName}`);
          } else {
            logger.error("Monaco model not available for Yjs binding.");
          }
        } catch (error) {
            logger.error("Failed to initialize Yjs WebrtcProvider:", error);
            // Fallback or error handling
        }


      }


      return () => {
        // Cleanup Yjs
        if (bindingRef.current) {
          logger.debug("Disposing MonacoBinding");
          bindingRef.current.destroy();
          bindingRef.current = null;
        }
        if (providerRef.current) {
          logger.debug("Disconnecting WebrtcProvider");
          providerRef.current.disconnect();
          providerRef.current.destroy(); // Ensure provider is fully destroyed
          providerRef.current = null;
        }
        if (ydocRef.current) {
          logger.debug("Destroying Y.Doc");
          ydocRef.current.destroy();
          ydocRef.current = null;
        }
        setIsCollabReady(false);

        // Cleanup Monaco editor instance if this component instance is truly unmounting
        // This needs careful handling if the editor instance should persist across filePath changes.
        // For now, assuming a new editor instance per mount/filePath for simplicity with Yjs.
        if (editorRef.current && containerRef.current && !containerRef.current.isConnected) {
             logger.debug("Disposing Monaco editor instance as container is disconnected.");
             editorRef.current.dispose();
             editorRef.current = null;
        } else if (editorRef.current && !currentDocRef.current) {
            // If doc becomes undefined, perhaps clean up editor or reset its state
            logger.debug("Document is undefined, disposing Monaco editor.");
            // editorRef.current.dispose(); // This might be too aggressive
            // editorRef.current = null;
        }
      };
    }, [currentDocRef.current?.filePath]); // Re-run if filePath changes to set up new Yjs room, or when container is ready


    // Effect for handling content changes (especially when Yjs is active)
    useEffect(() => {
        if (editorRef.current && onChangeRef.current) {
            const disposable = editorRef.current.onDidChangeModelContent(() => {
                if (isCollabReady && ydocRef.current) {
                    // When Yjs is active, Yjs handles the model updates.
                    // The change event might still be useful for other app logic.
                    // Y.Doc's 'update' event is another way to listen for changes.
                }
                const content = editorRef.current!.getValue();
                const selection = editorRef.current!.getSelection();
                onChangeRef.current({ content, selection });
            });
            return () => disposable.dispose();
        }
    }, [isCollabReady]); // Re-subscribe if collab readiness changes


    // Update editor model and language when document changes (and Yjs is not managing it or needs re-init)
    useEffect(() => {
      if (editorRef.current && doc && !isCollabReady) { // Only manage model directly if Yjs is not ready/active
        const model = editorRef.current.getModel();
        if (model) {
            if (doc.value !== model.getValue()) {
                 model.setValue(doc.value);
            }
            monaco.editor.setModelLanguage(model, getLanguageForFilePath(doc.filePath));
        }
      }

      if (editorRef.current && doc) {
        // Restore scroll position - independent of Yjs
        if (doc.scroll) {
          if (doc.scroll.scrollTop !== undefined) {
            editorRef.current.setScrollTop(doc.scroll.scrollTop);
          }
        }
        if (autoFocusOnDocumentChange && editable && !doc.isBinary && !isMobile()) {
          editorRef.current.focus();
        }
      }
    }, [doc, autoFocusOnDocumentChange, editable]);

    // Update read-only state
    useEffect(() => {
      if (editorRef.current) {
        editorRef.current.updateOptions({ readOnly: !editable || currentDocRef.current?.isBinary });
      }
    }, [editable, doc?.isBinary]);

    // Update theme
    useEffect(() => {
      if (editorRef.current) {
        monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
      }
    }, [theme]);

    // Update settings
    useEffect(() => {
      if (editorRef.current && settings) {
        editorRef.current.updateOptions({
          fontSize: settings.fontSize,
          tabSize: settings.tabSize,
        });
      }
    }, [settings]);


    if (doc?.isBinary) {
      // Potentially render a binary content placeholder or message
      return <div className={className}>Binary file content cannot be displayed.</div>;
    }

    return <div ref={containerRef} className={className} style={{ height: '100%', width: '100%' }} />;
  },
);

MonacoEditorComponent.displayName = 'MonacoEditor';

export const MonacoEditor = MonacoEditorComponent;

// Basic theme store integration for example, assuming your themeStore provides 'dark' | 'light'
export const ThemedMonacoEditor: React.FC<Omit<Props, 'theme'>> = (props) => {
  const appTheme = useStore(themeStore); // Assuming themeStore.get() returns 'dark' or 'light'
  return <MonacoEditor {...props} theme={appTheme} />;
};
