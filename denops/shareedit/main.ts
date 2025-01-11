import { Denops } from "jsr:@denops/std";
import { ensure, is } from "jsr:@core/unknownutil";
import { debounce } from "https://deno.land/std@0.224.0/async/mod.ts";

type TextContent = {
  type: "TextContent";
  sender: "vscode" | "vim";
  path: string;
  text: string;
  cursorLine: number;
  cursorCol: number;
};

type CursorPos = {
  type: "CursorPos";
  sender: "vscode" | "vim";
  path: string;
  line: number;
  col: number;
};

type SelectionPos = {
  type: "SelectionPos";
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  path: string;
};

const sockets = new Set<WebSocket>();

const ensureNumber = (arg: unknown): number => ensure(arg, is.Number);
const ensureString = (arg: unknown): string => ensure(arg, is.String);

export async function main(denops: Denops): Promise<void> {
  const debouncedSyncCursor = debounce(async () => {
    const line = ensureNumber(await denops.call("line", "."));
    const col = ensureNumber(await denops.call("col", "."));
    const path = ensureString(await denops.call("expand", "%:p"));
    const json: CursorPos = {
      type: "CursorPos",
      sender: "vim",
      path,
      line,
      col,
    };
    sockets.forEach((s) => s.send(JSON.stringify(json)));
  }, 100);

  denops.dispatcher = {
    async syncText(): Promise<void> {
      const currentBuffer = ensureString(await denops.call("expand", "%:p"));
      const line = ensureNumber(await denops.call("line", "."));
      const col = ensureNumber(await denops.call("col", "."));
      const body: TextContent = {
        type: "TextContent",
        sender: "vim",
        path: currentBuffer,
        text: await getCurrentText(denops),
        cursorLine: line,
        cursorCol: col,
      };

      sockets.forEach((s) => {
        s.send(JSON.stringify(body));
      });
      return Promise.resolve();
    },
    syncCursorPos: debouncedSyncCursor,
    async syncSelectionPos(
      startLine: unknown,
      startCol: unknown,
      endLine: unknown,
      endCol: unknown,
    ): Promise<void> {
      const startLineNum = ensureNumber(startLine);
      const startColNum = ensureNumber(startCol);
      const endLineNum = ensureNumber(endLine);
      const endColNum = ensureNumber(endCol);
      const currentBuffer = ensureString(await denops.call("expand", "%:p"));
      const json: SelectionPos = {
        type: "SelectionPos",
        startLine: startLineNum,
        startCol: startColNum,
        endLine: endLineNum,
        endCol: endColNum,
        path: currentBuffer,
      };
      sockets.forEach((s) => {
        s.send(JSON.stringify(json));
      });
      return Promise.resolve();
    },
    async setPort(port: unknown): Promise<void> {
      const portNumber = ensureNumber(port);
      if (portNumber < 1 || portNumber > 65535) {
        throw new Error("Port number must be between 1 and 65535");
      }
      // Restart the server with new port
      runWsServer(denops, portNumber);
      return Promise.resolve();
    },
  };
  return Promise.resolve();
}

function handleWs(denops: Denops, req: Request): Response {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("not trying to upgrade as websocket.");
  }
  const { socket, response } = Deno.upgradeWebSocket(req);
  sockets.add(socket);

  socket.onclose = () => {
    sockets.delete(socket);
  };

  socket.onmessage = async (_e) => {
    const msg = JSON.parse(_e.data);
    if (msg.type === "CursorPos") {
      const cursorPos = msg as CursorPos;
      await denops.cmd(`call cursor(${cursorPos.line}, ${cursorPos.col})`);
    }
  };

  socket.onerror = (e) => console.error("error", e);
  return response;
}

function runWsServer(denops: Denops, port: number) {
  Deno.serve(
    { hostname: "0.0.0.0", port },
    (req) => handleWs(denops, req),
  );
}

async function getCurrentText(denops: Denops): Promise<string> {
  const text = ensureString(await denops.call("getline", ".", "$"));
  return text;
}
