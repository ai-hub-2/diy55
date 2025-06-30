import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { spawn } from 'child_process';

// SECURITY WARNING: Executing arbitrary commands received from a client is highly dangerous.
// This is a basic example and needs significant hardening for any real-world use.
// - Input sanitization/validation is crucial.
// - Restrict the available commands.
// - Run commands in a sandboxed environment.
// - Implement proper user authentication and authorization.
// - Consider the execution context (e.g., current working directory).

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  let commandPayload;
  try {
    commandPayload = await request.json();
  } catch (error) {
    return json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { command } = commandPayload as { command?: string };

  if (!command || typeof command !== 'string' || command.trim() === '') {
    return json({ error: 'Command is required and must be a non-empty string' }, { status: 400 });
  }

  // Basic sanitization attempt (very naive, not foolproof)
  // For example, prevent command chaining with ';' or '&&' if we split by space for args
  // A more robust solution would be to parse the command and arguments properly.
  if (command.includes(';') || command.includes('&&') || command.includes('||') || command.includes('|') || command.includes('`')) {
    return json({ error: 'Invalid characters in command.' }, { status: 400 });
  }

  const parts = command.split(' ').filter(part => part.length > 0);
  const cmd = parts[0];
  const args = parts.slice(1);

  // Whitelist allowed commands for better security (example)
  const allowedCommands = ['ls', 'echo', 'node', 'npm', 'pnpm', 'git', 'pwd', 'cd', 'cat', 'mkdir', 'touch'];
  if (!allowedCommands.includes(cmd)) {
    return json({ error: `Command not allowed: ${cmd}` }, { status: 403 });
  }

  // Special handling for 'cd' - it's a shell builtin and doesn't work directly with spawn
  // to change the CWD of the Node.js process itself for subsequent commands in the same API call.
  // Each `spawn` is independent. Maintaining CWD across calls requires more complex state management.
  // For now, 'cd' won't actually change the directory for future API calls to this endpoint.
  if (cmd === 'cd') {
    // We can try to execute `cd` and report success/failure, but it won't persist.
    // Or, we can choose to disallow it or handle its effect on a virtual CWD if we build that.
    // For this example, let's just echo the attempt.
     return new Response(`Executing "${command}" (Note: 'cd' effects are not persistent across requests here)\n`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
  }


  try {
    const stream = new ReadableStream({
      start(controller) {
        const child = spawn(cmd, args, {
          shell: false, // Avoid shell features like variable expansion, wildcard globbing for security
                       // Set to true if you need shell interpretation, but be extremely careful.
          // cwd: process.cwd(), // Or a project-specific directory
        });

        const send = (data: string | Uint8Array) => {
          try {
            controller.enqueue(typeof data === 'string' ? new TextEncoder().encode(data) : data);
          } catch (e) {
            // Handle cases where the stream might have been closed prematurely
            console.error("Error enqueuing data to stream:", e);
          }
        };

        child.stdout.on('data', (data) => {
          send(data);
        });

        child.stderr.on('data', (data) => {
          send(data); // Send stderr to the same stream for simplicity
        });

        child.on('error', (error) => {
          send(`\r\nSpawn error: ${error.message}\r\n`);
          console.error(`Spawn error for command "${command}":`, error);
          if (!controller.desiredSize) return; // Stream already closed or errored
          controller.close();
        });

        child.on('close', (code) => {
          send(`\r\nProcess exited with code ${code}\r\n`);
           if (!controller.desiredSize) return; // Stream already closed or errored
          controller.close();
        });

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          child.kill(); // Kill the child process if the client aborts the request
          if (!controller.desiredSize) return;
          controller.close();
          console.log(`Client aborted request for command: ${command}`);
        });
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8', // Streaming plain text
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error: any) {
    console.error(`Error executing command "${command}":`, error);
    return json({ error: `Failed to execute command: ${error.message}` }, { status: 500 });
  }
}
