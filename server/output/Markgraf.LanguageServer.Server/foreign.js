export const startServerImpl = diagnosticsJson => {
  let buffer = Buffer.alloc(0);
  const documents = new Map();

  const send = message => {
    const json = JSON.stringify(message);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`);
  };

  const publishDiagnostics = (uri, text) => {
    send({
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri, diagnostics: JSON.parse(diagnosticsJson(text)) }
    });
  };

  const handle = message => {
    if (message.method === "initialize") {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          capabilities: {
            textDocumentSync: 1
          },
          serverInfo: { name: "markgraf-language-server", version: "0.1.0" }
        }
      });
      return;
    }

    if (message.method === "shutdown") {
      send({ jsonrpc: "2.0", id: message.id, result: null });
      return;
    }

    if (message.method === "exit") {
      process.exit(0);
      return;
    }

    if (message.method === "textDocument/didOpen") {
      const doc = message.params.textDocument;
      documents.set(doc.uri, doc.text);
      publishDiagnostics(doc.uri, doc.text);
      return;
    }

    if (message.method === "textDocument/didChange") {
      const uri = message.params.textDocument.uri;
      const text = message.params.contentChanges.at(-1)?.text ?? documents.get(uri) ?? "";
      documents.set(uri, text);
      publishDiagnostics(uri, text);
    }
  };

  const pump = () => {
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = buffer.subarray(0, headerEnd).toString("utf8");
      const length = Number(header.match(/Content-Length: *(\d+)/i)?.[1]);
      if (!Number.isFinite(length)) return;
      const start = headerEnd + 4;
      const end = start + length;
      if (buffer.length < end) return;
      const body = buffer.subarray(start, end).toString("utf8");
      buffer = buffer.subarray(end);
      handle(JSON.parse(body));
    }
  };

  process.stdin.on("data", chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    pump();
  });
};
