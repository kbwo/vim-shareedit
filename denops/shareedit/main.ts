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
  centerLine: number | null;
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

const getCurrentLine = async (denops: Denops): Promise<number> =>
  ensureNumber(await denops.call("line", "."));

const getCurrentCol = async (denops: Denops): Promise<number> =>
  ensureNumber(
    await denops.call(
      "strcharlen",
      await denops.call(
        "strpart",
        await denops.call("getline", "."),
        0,
        ensureNumber(await denops.call("col", ".")) - 1,
      ),
    ),
  ) + 1;

const getCenterLine = async (denops: Denops): Promise<number> => {
  const visibleStartLine = ensureNumber(await denops.call("line", "w0"));
  const visibleEndLine = ensureNumber(await denops.call("line", "w$"));
  return Math.floor((visibleStartLine + visibleEndLine) / 2);
};

let lastCursorPos: {
  path: string;
  line: number;
  col: number;
  centerLine: number | null;
} | null = null;

export function main(denops: Denops): Promise<void> {
  const debouncedSyncCursor = debounce(
    async (line: unknown, col: unknown) => {
      const lineNum = ensureNumber(line);
      const colNum = ensureNumber(col);
      const path = ensureString(await denops.call("expand", "%:p"));
      const centerLine = await getCenterLine(denops);
      const json: CursorPos = {
        type: "CursorPos",
        sender: "vim",
        path,
        line: lineNum,
        col: colNum,
        centerLine,
      };
      sockets.forEach((s) => s.send(JSON.stringify(json)));
    },
    50,
  );

  function handleWs(denops: Denops, req: Request): Response {
    if (req.headers.get("upgrade") !== "websocket") {
      return new Response("not trying to upgrade as websocket.");
    }
    const { socket, response } = Deno.upgradeWebSocket(req);
    sockets.add(socket);

    socket.onopen = () => {
      console.log("ShareEdit: Client connected");
    };

    socket.onclose = () => {
      console.log("ShareEdit: Client disconnected");
      sockets.delete(socket);
    };

    socket.onmessage = async (_e) => {
      const msg = JSON.parse(_e.data);
      if (msg.type === "CursorPos") {
        let newCursorPos: Pick<
          CursorPos,
          "path" | "line" | "col" | "centerLine"
        > = { ...msg };
        const currentLine = await getCurrentLine(denops);
        const currentCol = await getCurrentCol(denops);
        const currentPath = ensureString(await denops.call("expand", "%:p"));
        const lastLine = ensureNumber(await denops.call("line", "$"));
        const line = ensureString(
          await denops.call("getline", newCursorPos.line),
        );
        const lastColOfNewLine = line.length;

        if (
          currentPath === newCursorPos.path &&
          (
            lastLine < newCursorPos.line ||
            lastColOfNewLine < newCursorPos.col
          )
        ) {
          newCursorPos = {
            path: currentPath,
            line: currentLine,
            col: currentCol,
            centerLine: newCursorPos.centerLine,
          };
        }

        if (currentPath !== newCursorPos.path) {
          await denops.cmd(`edit ${newCursorPos.path}`);
        }

        if (
          lastCursorPos &&
          lastCursorPos.path === newCursorPos.path &&
          lastCursorPos.line === newCursorPos.line &&
          lastCursorPos.col === newCursorPos.col &&
          lastCursorPos.centerLine === newCursorPos.centerLine
        ) {
          return;
        }
        if (
          newCursorPos.centerLine &&
          newCursorPos.centerLine !== lastCursorPos?.centerLine
        ) {
          await denops.cmd(
            `execute "noautocmd normal ${newCursorPos.centerLine}zz"`,
          );
          if (lastCursorPos) {
            lastCursorPos.centerLine = newCursorPos.centerLine;
          }
        }

        await denops.cmd(
          `execute "noautocmd call cursor(${newCursorPos.line}, ${newCursorPos.col})"`,
        );
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
      const currentBuffer = ensureString(await denops.call("expand", "%:p"));
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

      sockets.forEach((s) => {
        s.send(JSON.stringify(body));
      });
      return Promise.resolve();
    },

    syncCursorPos: async () => {
      const lineNum = await getCurrentLine(denops);
      const colNum = await getCurrentCol(denops);
      const currentPath = ensureString(await denops.call("expand", "%:p"));
      const centerLine = await getCenterLine(denops);

      if (
        lastCursorPos &&
        lastCursorPos.path === currentPath &&
        lastCursorPos.line === lineNum &&
        lastCursorPos.col === colNum &&
        lastCursorPos.centerLine === centerLine
      ) {
        return;
      }

      lastCursorPos = {
        path: currentPath,
        line: lineNum,
        col: colNum,
        centerLine,
      };

      debouncedSyncCursor(lineNum, colNum);
    },

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
    setPort(port: unknown): Promise<void> {
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

async function getCurrentText(denops: Denops): Promise<string> {
  const text = ensureString(await denops.call("getline", ".", "$"));
  return text;
}
