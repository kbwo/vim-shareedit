import { Denops } from "jsr:@denops/core@7.0.1/type";
import type { CursorPos, SelectionPos, TextContent } from "./types.ts";
import {
  getCurrentCol,
  getCurrentLine,
  getCurrentPath,
  getLastLine,
  getSpecificLineLength,
} from "./utils.ts";
import { cleanupSessions, saveSession } from "./session.ts";

// private field in WebSocketManager is not working
const sockets = new Set<WebSocket>();

export class WebSocketManager {
  private lastCursorPos: { path: string; line: number; col: number } | null =
    null;

  addSocket(socket: WebSocket) {
    sockets.add(socket);
  }

  removeSocket(socket: WebSocket) {
    sockets.delete(socket);
  }

  broadcast(data: TextContent | CursorPos | SelectionPos) {
    sockets.forEach((s) => s.send(JSON.stringify(data)));
  }

  getLastCursorPos() {
    return this.lastCursorPos;
  }

  setLastCursorPos(pos: { path: string; line: number; col: number }) {
    this.lastCursorPos = pos;
  }

  async handleCursorPosMessage(denops: Denops, msg: CursorPos) {
    let newCursorPos: { path: string; line: number; col: number } = { ...msg };
    const currentLine = await getCurrentLine(denops);
    const currentCol = await getCurrentCol(denops);
    const currentPath = await getCurrentPath(denops);
    const lastLine = await getLastLine(denops);
    const lastColOfNewLine = await getSpecificLineLength(
      denops,
      newCursorPos.line,
    );

    if (
      currentPath === newCursorPos.path &&
      (lastLine < newCursorPos.line || lastColOfNewLine < newCursorPos.col)
    ) {
      newCursorPos = {
        path: currentPath,
        line: currentLine,
        col: currentCol,
      };
    }

    const lastCursorPos = this.getLastCursorPos();
    if (
      lastCursorPos &&
      lastCursorPos.path === newCursorPos.path &&
      lastCursorPos.line === newCursorPos.line &&
      lastCursorPos.col === newCursorPos.col
    ) {
      return;
    }
    const buftype = (await denops.eval("&buftype")) as string;
    if (buftype === "terminal") {
      await denops.cmd(`tabnew ${newCursorPos.path}`);
    } else if (currentPath !== newCursorPos.path) {
      await denops.cmd(`edit ${newCursorPos.path}`);
    }

    this.setLastCursorPos({
      path: newCursorPos.path,
      line: newCursorPos.line,
      col: newCursorPos.col,
    });

    await denops.cmd(
      `execute "noautocmd call cursor(${newCursorPos.line}, ${newCursorPos.col})"`,
    );
  }
}

let currentServer: Deno.HttpServer<Deno.NetAddr> | null = null;

export async function stopWsServer() {
  if (!currentServer) {
    console.log("ShareEdit: No server to stop");
    return;
  }
  await currentServer.shutdown();
  await cleanupSessions();
  currentServer = null;
  console.log("ShareEdit: Server stopped");
}

const wsManager = new WebSocketManager();
console.log("initialize wsmanager");

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

export async function runWsServer(denops: Denops) {
  // Close existing server if it exists
  if (currentServer) {
    console.log("ShareEdit: Closing existing server");
    await currentServer.shutdown();
    currentServer = null;
  }

  // Clean up stale sessions before starting new server
  await cleanupSessions();

  const server = Deno.serve({ port: 0 }, (req) => handleWs(denops, req));
  currentServer = server;
  const port = server.addr.port;

  // Save session information
  await saveSession(port);
}
