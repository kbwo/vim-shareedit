import { Denops } from "jsr:@denops/core@7.0.1/type";
import type { CursorPos, SelectionPos, TextContent } from "./types.ts";
import {
  getCurrentCol,
  getCurrentLine,
  getCurrentPath,
  getLastLine,
  getSpecificLineLength,
} from "./utils.ts";

export class WebSocketManager {
  private sockets = new Set<WebSocket>();
  private lastCursorPos: { path: string; line: number; col: number } | null =
    null;

  addSocket(socket: WebSocket) {
    this.sockets.add(socket);
  }

  removeSocket(socket: WebSocket) {
    this.sockets.delete(socket);
  }

  broadcast(data: TextContent | CursorPos | SelectionPos) {
    this.sockets.forEach((s) => s.send(JSON.stringify(data)));
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

    if (currentPath !== newCursorPos.path) {
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
