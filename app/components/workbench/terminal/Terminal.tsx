import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { AttachAddon } from '@xterm/addon-attach'; // Added AttachAddon
import { Terminal as XTerm } from '@xterm/xterm';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from '~/utils/logger';
import { getTerminalTheme } from './theme';

const logger = createScopedLogger('Terminal');

// Define a default WebSocket URL. This should ideally be configurable.
const DEFAULT_WEBSOCKET_URL = 'ws://localhost:3001/shell'; // Example backend shell WebSocket URL

export interface TerminalRef {
  reloadStyles: () => void;
  focus: () => void;
  getWebSocket: () => WebSocket | null;
}

export interface TerminalProps {
  className?: string;
  theme: Theme;
  readonly?: boolean;
  id: string; // Used for logging and potentially unique WebSocket connections
  webSocketUrl?: string; // Allow overriding the WebSocket URL
  onTerminalReady?: (terminal: XTerm) => void;
  onTerminalResize?: (cols: number, rows: number) => void;
}

export const Terminal = memo(
  forwardRef<TerminalRef, TerminalProps>(
    ({ className, theme, readonly, id, webSocketUrl, onTerminalReady, onTerminalResize }, ref) => {
      const terminalElementRef = useRef<HTMLDivElement>(null);
      const terminalRef = useRef<XTerm>();
      const webSocketRef = useRef<WebSocket | null>(null);
      const fitAddonRef = useRef<FitAddon>();
      const [isConnected, setIsConnected] = useState(false);

      const wsUrl = webSocketUrl || DEFAULT_WEBSOCKET_URL;

      useEffect(() => {
        if (!terminalElementRef.current) return;

        const element = terminalElementRef.current;
        const currentFitAddon = new FitAddon();
        fitAddonRef.current = currentFitAddon;
        const webLinksAddon = new WebLinksAddon();

        const term = new XTerm({
          cursorBlink: true,
          convertEol: true,
          disableStdin: readonly,
          theme: getTerminalTheme(readonly ? { cursor: '#00000000' } : {}),
          fontSize: 12,
          fontFamily: 'Menlo, courier-new, courier, monospace',
        });
        terminalRef.current = term;

        term.loadAddon(currentFitAddon);
        term.loadAddon(webLinksAddon);
        term.open(element);
        currentFitAddon.fit(); // Initial fit

        logger.debug(`Terminal [${id}] initialized.`);
        onTerminalReady?.(term);

        // Setup WebSocket connection
        if (!readonly) {
          logger.debug(`Terminal [${id}] attempting to connect to WebSocket: ${wsUrl}`);
          const ws = new WebSocket(wsUrl);
          webSocketRef.current = ws;

          ws.onopen = () => {
            logger.info(`Terminal [${id}] WebSocket connection established.`);
            setIsConnected(true);
            const attachAddon = new AttachAddon(ws);
            term.loadAddon(attachAddon);
            // Send initial size to backend if needed by the PTY
            // term.write(`\x1b[8;${term.rows};${term.cols}t`); // AttachAddon handles initial communication often

            // Custom data handler for /ai commands
            term.onData(async (data) => {
              // Check if the input is an /ai command
              // This is a simplistic check, assumes /ai is at the start of a line.
              // A more robust solution would parse the command line buffer.
              const commandLine = term.buffer.active.getLine(term.buffer.active.cursorY)?.translateToString(true) || "";

              if (data === '\r') { // User pressed Enter
                const trimmedLine = commandLine.trim();
                if (trimmedLine.startsWith('/ai ')) {
                  const aiQuery = trimmedLine.substring(4); // Extract query after "/ai "
                  // Prevent default processing by AttachAddon for this command
                  // This is tricky with AttachAddon as it directly forwards input.
                  // A common approach is to handle this on the server-side PTY
                  // OR to have a custom AttachAddon or intercept data before it's sent.

                  // For client-side interception (conceptual - might need a custom addon or different handling):
                  // If we could prevent AttachAddon from sending this specific input:
                  // e.stopImmediatePropagation(); // This is not a real event API for onData

                  term.writeln(`\r\n\x1b[36mAI Query:\x1b[0m ${aiQuery}`);
                  term.writeln('\x1b[33mProcessing with AI...\x1b[0m');

                  try {
                    // Replace with your actual AI API call
                    const response = await fetch('/api/llmcall', { // Assuming an existing API route
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        messages: [{ role: 'user', content: aiQuery }],
                        // Include other necessary parameters for your llmcall API
                      }),
                    });

                    if (!response.ok) {
                      const errorText = await response.text();
                      throw new Error(`AI API Error: ${response.status} ${errorText}`);
                    }

                    // Assuming the response is plain text for simplicity
                    // If it's a stream, you'd handle it differently.
                    const aiResponse = await response.text(); // Or response.json().then(data => data.result) etc.
                    term.writeln(`\x1b[32mAI Response:\x1b[0m ${aiResponse.replace(/\n/g, '\r\n')}`);
                  } catch (error: any) {
                    logger.error("AI command error:", error);
                    term.writeln(`\x1b[31mError processing AI command: ${error.message}\x1b[0m`);
                  }
                  // After handling /ai, clear the current line and prompt for new input
                  // This also needs careful implementation to not interfere with normal shell behavior.
                  // One way is to send control characters to clear the line if the PTY supports it.
                  // Or, if the PTY echoes commands, this might already be handled.
                  // For a true shell, the PTY would print a new prompt.
                  // If not using a real PTY, you might need to manually write a new prompt.
                  // term.write('\r\n$ '); // Example new prompt
                  // This is a simplified client-side approach.
                  // A robust solution often involves server-side command parsing if using a real PTY.
                  // For now, we let AttachAddon send the original command too, the server can ignore it.
                  // Or, the user has to manually clear the /ai command.
                  // To avoid sending to backend, a more complex setup is needed,
                  // possibly by creating a custom addon or modifying AttachAddon behavior.
                  // For now, the command will be sent to the backend PTY as well, which might result in "command not found".
                }
              }
              // Default behavior: let AttachAddon send the data to WebSocket if not handled as /ai
              // This is implicit as AttachAddon is already loaded.
              // If we wanted to *selectively* send data, we'd need to remove default AttachAddon's onData listener
              // and call ws.send(data) manually.
            });
          };

          ws.onclose = (event) => {
            logger.warn(`Terminal [${id}] WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
            setIsConnected(false);
            term.writeln('\r\n\x1b[31mConnection to server lost.\x1b[0m');
            // Optionally, you might want to disable stdin or show an overlay
          };

          ws.onerror = (error) => {
            logger.error(`Terminal [${id}] WebSocket error:`, error);
            setIsConnected(false);
            term.writeln('\r\n\x1b[31mWebSocket connection error.\x1b[0m');
          };
        }

        const resizeObserver = new ResizeObserver(() => {
          if (fitAddonRef.current && terminalRef.current) {
            fitAddonRef.current.fit();
            onTerminalResize?.(terminalRef.current.cols, terminalRef.current.rows);
            if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
              // Send resize command to backend PTY if protocol supports it
              // Example for some PTYs: { type: 'resize', cols: terminalRef.current.cols, rows: terminalRef.current.rows }
              // Or using escape sequence if the backend shell understands it:
              // webSocketRef.current.send(`\x1b[8;${terminalRef.current.rows};${terminalRef.current.cols}t`);
              // For simplicity, we'll assume a JSON message structure if backend expects it.
              // This part is highly dependent on your backend shell's WebSocket protocol.
              // Example: webSocketRef.current.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
            }
          }
        });
        resizeObserver.observe(element);

        return () => {
          resizeObserver.disconnect();
          if (webSocketRef.current) {
            logger.debug(`Terminal [${id}] closing WebSocket connection.`);
            webSocketRef.current.close();
          }
          if (terminalRef.current) {
            logger.debug(`Terminal [${id}] disposing.`);
            terminalRef.current.dispose();
          }
          fitAddonRef.current = undefined;
        };
      }, [readonly, id, wsUrl, onTerminalReady, onTerminalResize]); // wsUrl is added as a dependency

      useEffect(() => {
        if (terminalRef.current) {
          terminalRef.current.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
          terminalRef.current.options.disableStdin = readonly;
        }
      }, [theme, readonly]);

      useImperativeHandle(ref, () => ({
        reloadStyles: () => {
          if (terminalRef.current) {
            terminalRef.current.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
          }
        },
        focus: () => {
          terminalRef.current?.focus();
        },
        getWebSocket: () => webSocketRef.current,
      }));

      return (
        <div className={className} style={{ height: '100%', width: '100%' }}>
          {!readonly && !isConnected && (
            <div style={{ position: 'absolute', top: '5px', left: '5px', color: 'yellow', zIndex: 10 }}>
              Connecting to shell...
            </div>
          )}
          <div ref={terminalElementRef} style={{ height: '100%', width: '100%' }} />
        </div>
      );
    },
  ),
);
