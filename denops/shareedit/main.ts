import { Denops } from "jsr:@denops/std";
import { debounce } from "https://deno.land/std@0.224.0/async/mod.ts";
import { WebSocketManager } from "./websocket.ts";
import {
  ensureNumber,
  ensureString,
  getCurrentCol,
  getCurrentLine,
  getCurrentPath,
  getCurrentText,
} from "./utils.ts";
import type { CursorPos, SelectionPos, TextContent } from "./types.ts";

const wsManager = new WebSocketManager();

export function main(denops: Denops): Promise<void> {
  const debouncedSyncCursor = debounce(
    async (line: unknown, col: unknown) => {
      const lineNum = ensureNumber(line);
      const colNum = ensureNumber(col);
      const path = ensureString(await denops.call("expand", "%:p"));
      const json: CursorPos = {
        type: "CursorPos",
        sender: "vim",
        path,
        line: lineNum,
        col: colNum,
      };
      wsManager.broadcast(json);
    },
    50,
  );

  function handleWs(denops: Denops, req: Request): Response {
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("not trying to upgrade as websocket.");
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    wsManager.addSocket(socket);

    socket.onopen = () => {
      console.log("ShareEdit: Client connected");
    };

    socket.onclose = () => {
      console.log("ShareEdit: Client disconnected");
      wsManager.removeSocket(socket);
    };

    socket.onmessage = async (_e) => {
      const msg = JSON.parse(_e.data);
      if (msg.type === "CursorPos") {
        await wsManager.handleCursorPosMessage(denops, msg);
      }
    };

    socket.onerror = (e) => console.error("ShareEdit error:", e);
    return response;
  }

  function runWsServer(denops: Denops, port: number) {
    Deno.serve(
      { port },
      (req) => handleWs(denops, req),
    );
  }

  denops.dispatcher = {
    async syncText(): Promise<void> {
      const currentBuffer = await getCurrentPath(denops);
      const line = await getCurrentLine(denops);
      const col = await getCurrentCol(denops);
      const body: TextContent = {
        type: "TextContent",
        sender: "vim",
        path: currentBuffer,
        text: await getCurrentText(denops),
        cursorLine: line,
        cursorCol: col,
      };

      wsManager.broadcast(body);
      return Promise.resolve();
    },

    syncCursorPos: async () => {
      const lineNum = await getCurrentLine(denops);
      const colNum = await getCurrentCol(denops);
      const currentPath = await getCurrentPath(denops);
      const lastCursorPos = wsManager.getLastCursorPos();

      if (
        lastCursorPos &&
        lastCursorPos.path === currentPath &&
        lastCursorPos.line === lineNum &&
        lastCursorPos.col === colNum
      ) {
        return;
      }

      wsManager.setLastCursorPos({
        path: currentPath,
        line: lineNum,
        col: colNum,
      });
      debouncedSyncCursor(lineNum, colNum);
    },

    async syncSelectionPos(
      startLine: unknown,
      startCol: unknown,
      endLine: unknown,
      endCol: unknown,
    ): Promise<void> {
      const json: SelectionPos = {
        type: "SelectionPos",
        startLine: ensureNumber(startLine),
        startCol: ensureNumber(startCol),
        endLine: ensureNumber(endLine),
        endCol: ensureNumber(endCol),
        path: await getCurrentPath(denops),
      };
      wsManager.broadcast(json);
      return Promise.resolve();
    },

    run(port: unknown) {
      const portNumber = ensureNumber(port);
      if (portNumber < 1 || portNumber > 65535) {
        throw new Error("Port number must be between 1 and 65535");
      }
      runWsServer(denops, portNumber);
    },
  };

  return Promise.resolve();
}
