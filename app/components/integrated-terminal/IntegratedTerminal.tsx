import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useStore } from '@nanostores/react';
import { terminalStore } // Assuming a new zustand store slice or adapting existing nanostore for visibility
from '~/lib/stores/terminal'; // This is the existing nanostore, might need a new one or adapt for integration

// TODO: Replace with Zustand store slice for terminal state
// For now, using a local state for visibility as an example
// const useTerminalVisibility = () => {
//   const [isVisible, setIsVisible] = useState(true); // Default to visible for now
//   return { isVisible, setIsVisible };
// };

interface IntegratedTerminalProps {
  // Props if any, e.g., initial command, session ID for context
}

const IntegratedTerminal: React.FC<IntegratedTerminalProps> = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // const { isVisible } = useTerminalVisibility(); // TODO: Integrate with global state

  const [currentLine, setCurrentLine] = useState('');

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    const xterm = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'Menlo, "DejaVu Sans Mono", Consolas, "Lucida Console", monospace',
      // theme: {} // TODO: Adapt theme from existing app theme (light/dark)
    });
    xtermRef.current = xterm;

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    xterm.loadAddon(fitAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    // Simple prompt
    xterm.write('$ ');

    xterm.onData(async (data) => {
      const code = data.charCodeAt(0);
      if (code === 13) { // Enter
        if (currentLine.trim().length > 0) {
          xterm.writeln(''); // New line after command
          await executeCommand(currentLine);
        }
        setCurrentLine('');
        xterm.write('\r\n$ '); // New prompt
      } else if (code === 127) { // Backspace
        if (currentLine.length > 0) {
          xterm.write('\b \b');
          setCurrentLine(currentLine.slice(0, -1));
        }
      } else if (code < 32) { // Control character
        return;
      } else { // Printable character
        xterm.write(data);
        setCurrentLine(currentLine + data);
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    if (terminalRef.current.parentElement) {
         resizeObserver.observe(terminalRef.current.parentElement);
    }


    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
      xtermRef.current = null;
    };
  }, []);

  const executeCommand = async (command: string) => {
    if (!xtermRef.current) return;

    xtermRef.current.writeln(`Executing: ${command}`); // Echo command execution attempt

    try {
      const response = await fetch('/api/v2/terminal/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        const errorResult = await response.json();
        xtermRef.current.writeln(`Error: ${response.status} ${errorResult.error || response.statusText}`);
        return;
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Replace newlines for proper terminal display
          xtermRef.current.write(chunk.replace(/\n/g, '\r\n'));
        }
      }
    } catch (error) {
      console.error('Failed to execute command:', error);
      xtermRef.current.writeln(`\r\nNetwork or execution error: ${(error as Error).message}`);
    }
  };

  // TODO: Control visibility via Zustand store
  // if (!isVisible) {
  //   return null;
  // }

  return (
    <div style={{ width: '100%', height: '300px', backgroundColor: '#1e1e1e' /* Example dark theme */ }}>
      <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default IntegratedTerminal;
