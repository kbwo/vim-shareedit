interface SessionInfo {
  port: number;
  directory: string;
  timestamp: number;
}

function getConfigDir(): string {
  const platform = Deno.build.os;

  if (platform === "windows") {
    // Windows: %APPDATA%\shareedit
    const appData = Deno.env.get("APPDATA");
    if (!appData) throw new Error("APPDATA environment variable not found");
    return `${appData}\\shareedit`;
  } else {
    // Unix-like (Linux/macOS): ~/.config/shareedit
    const homeDir = Deno.env.get("HOME");
    if (!homeDir) throw new Error("HOME environment variable not found");
    return `${homeDir}/.config/shareedit`;
  }
}

async function ensureConfigDir(): Promise<void> {
  const configDir = getConfigDir();
  try {
    await Deno.mkdir(configDir, { recursive: true });
  } catch (error) {
    console.error("ShareEdit: Failed to create config directory:", error);
  }
}

export async function saveSession(port: number): Promise<void> {
  await ensureConfigDir();
  const configDir = getConfigDir();
  const shareEditFile = `${configDir}/sessions.json`;
  const currentDir = Deno.cwd();

  try {
    let sessions: SessionInfo[] = [];
    try {
      const content = Deno.readTextFileSync(shareEditFile);
      sessions = JSON.parse(content);
    } catch {
      // If file doesn't exist or is invalid, start with empty array
    }

    const newSession: SessionInfo = {
      port,
      directory: currentDir,
      timestamp: Date.now(),
    };

    sessions.push(newSession);
    Deno.writeTextFileSync(shareEditFile, JSON.stringify(sessions, null, 2));
  } catch (error) {
    console.error("ShareEdit: Failed to write session info:", error);
  }
}

export async function cleanupSessions(): Promise<void> {
  await ensureConfigDir();
  const configDir = getConfigDir();
  const shareEditFile = `${configDir}/sessions.json`;

  try {
    // Read existing sessions
    const content = await Deno.readTextFile(shareEditFile);
    let sessions: SessionInfo[] = [];
    try {
      sessions = JSON.parse(content);
    } catch {
      // If JSON parse fails, start with empty array
      sessions = [];
    }

    const validSessions: SessionInfo[] = [];

    // Check each session
    for (const session of sessions) {
      try {
        // Try to create a WebSocket connection to test if port is in use
        const ws = new WebSocket(`ws://127.0.0.1:${session.port}`);
        await new Promise((resolve, reject) => {
          ws.onopen = () => {
            ws.close();
            resolve(true);
          };
          ws.onerror = () => {
            ws.close();
            reject();
          };
        });
        // Port is in use, keep this session
        validSessions.push(session);
      } catch {
        // Port is not in use, skip this session
      }
    }

    // Write back valid sessions
    await Deno.writeTextFile(
      shareEditFile,
      JSON.stringify(validSessions, null, 2),
    );
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.error("ShareEdit: Error cleaning up sessions:", error);
    }
  }
}
