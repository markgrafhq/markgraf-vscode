import * as vscode from "vscode";
import { LanguageClient, TransportKind } from "vscode-languageclient/node.js";

let client = null;
let previewPanel = null;
let previewDocument = null;

export const activateImpl = (config, context) => {
  const extensionConfig = vscode.workspace.getConfiguration();
  const configuredCommand = extensionConfig.get(config.serverRuntimeSetting);
  const configuredServerPath = extensionConfig.get(config.serverCommandSetting);
  const bundledServerPath = vscode.Uri.joinPath(
    context.extensionUri,
    "server",
    "bin",
    "markgraf-language-server.js"
  ).fsPath;
  const command = configuredCommand || process.execPath;
  const serverPath = configuredServerPath || bundledServerPath;

  client = new LanguageClient(
    config.languageId,
    config.serverName,
    {
      command,
      args: [serverPath],
      transport: TransportKind.stdio
    },
    {
      documentSelector: [{ scheme: "file", language: config.languageId }]
    }
  );

  client.start();
  context.subscriptions.push({ dispose: () => client?.stop() });
  context.subscriptions.push(vscode.commands.registerCommand(config.previewCommand, () => openPreview(config, context)));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => updatePreviewForDocument(event.document)));
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor?.document.languageId === config.languageId && previewPanel) {
      previewDocument = editor.document;
      updatePreview(editor.document);
    }
  }));
};

export const deactivateImpl = () => {
  const current = client;
  client = null;
  previewPanel?.dispose();
  previewPanel = null;
  previewDocument = null;
  current?.stop();
};

const openPreview = (config, context) => {
  const document = vscode.window.activeTextEditor?.document;
  if (!document || document.languageId !== config.languageId) {
    vscode.window.showWarningMessage("Open a Markgraf file before running Markgraf: Preview.");
    return;
  }

  previewDocument = document;

  if (previewPanel) {
    previewPanel.reveal(vscode.ViewColumn.Beside);
    updatePreview(document);
    return;
  }

  const embedDist = vscode.Uri.joinPath(context.extensionUri, "embed", "dist");
  previewPanel = vscode.window.createWebviewPanel(
    "markgrafPreview",
    config.previewTitle,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [embedDist]
    }
  );

  previewPanel.onDidDispose(() => {
    previewPanel = null;
    previewDocument = null;
  });

  previewPanel.webview.html = previewHtml(previewPanel.webview, embedDist, document.getText(), defaultPreviewTheme());
};

const updatePreviewForDocument = document => {
  if (!previewDocument || document.uri.toString() !== previewDocument.uri.toString()) {
    return;
  }

  previewDocument = document;
  updatePreview(document);
};

const updatePreview = document => {
  previewPanel?.webview.postMessage({ type: "source", source: document.getText() });
};

const defaultPreviewTheme = () => {
  switch (vscode.window.activeColorTheme.kind) {
    case vscode.ColorThemeKind.Dark:
    case vscode.ColorThemeKind.HighContrast:
      return "dark";
    case vscode.ColorThemeKind.Light:
    case vscode.ColorThemeKind.HighContrastLight:
    default:
      return "light";
  }
};

const previewHtml = (webview, embedDist, source, defaultTheme) => {
  const nonce = makeNonce();
  const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(embedDist, "markgraf-embed.css"));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(embedDist, "markgraf-embed.js"));
  const initialSource = JSON.stringify(source);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
  <link rel="stylesheet" href="${cssUri}">
  <style>
    :root {
      color-scheme: light dark;
    }

    body {
      margin: 0;
      padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
    }

    .preview-shell {
      min-height: 100vh;
      box-sizing: border-box;
      padding: 12px 16px 16px;
    }

    .preview-toolbar {
      position: relative;
      z-index: 10;
      width: fit-content;
      margin: 0 0 10px auto;
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb, var(--vscode-editor-background) 72%, transparent);
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.16);
      opacity: 0;
      transition: opacity 120ms ease;
      backdrop-filter: blur(18px);
    }

    .preview-shell:hover .preview-toolbar,
    .preview-toolbar:focus-within {
      opacity: 1;
    }

    .theme-button {
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 4px 9px;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      font: 11px var(--vscode-font-family);
      line-height: 1;
      cursor: pointer;
    }

    .theme-button:hover {
      color: var(--vscode-editor-foreground);
      background: color-mix(in srgb, var(--vscode-editor-foreground) 8%, transparent);
    }

    .theme-button[aria-pressed="true"] {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }

    #preview {
      min-width: 100%;
      min-height: 180px;
      --mg-max-height: calc(100vh - 96px);
    }

    #preview.markgraf-embed {
      display: flex;
      flex-direction: column;
      border-radius: 14px;
      background: var(--vscode-editor-background);
    }

    #preview.markgraf-embed[data-markgraf-theme="whiteboard"] {
      background: #fff;
    }

    #preview.markgraf-embed [data-mg="play-overlay"] {
      display: none;
    }

    #preview.markgraf-embed [data-mg="bar"] {
      order: 1;
      position: relative;
      width: min(560px, calc(100% - 44px));
      margin: 12px auto 0;
      display: grid;
      grid-template-columns: 24px minmax(120px, 1fr) auto auto;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      background: rgba(8, 13, 22, 0.52);
      color: #fff;
      box-shadow: 0 14px 44px rgba(0, 0, 0, 0.28);
      opacity: 0;
      transition: opacity 140ms ease, background 140ms ease;
      backdrop-filter: blur(18px);
    }

    #preview.markgraf-embed:hover [data-mg="bar"],
    #preview.markgraf-embed [data-mg="bar"]:focus-within {
      opacity: 0.96;
      background: rgba(8, 13, 22, 0.68);
    }

    #preview.markgraf-embed [data-mg="play"] {
      width: 24px;
      height: 24px;
      color: #fff;
      background: rgba(255, 255, 255, 0.08);
    }

    #preview.markgraf-embed [data-mg="play"]:hover {
      background: rgba(255, 255, 255, 0.18);
    }

    #preview.markgraf-embed [data-mg="play"]::before {
      width: 12px;
      height: 12px;
    }

    #preview.markgraf-embed [data-mg="time"] {
      color: rgba(255, 255, 255, 0.74);
      font-size: 10px;
      font-variant-numeric: tabular-nums;
    }

    #preview.markgraf-embed [data-mg="speed"] {
      appearance: none;
      border: 0;
      border-radius: 999px;
      padding: 3px 19px 3px 8px;
      background:
        linear-gradient(45deg, transparent 50%, rgba(255,255,255,.72) 50%) calc(100% - 11px) 50% / 5px 5px no-repeat,
        linear-gradient(135deg, rgba(255,255,255,.72) 50%, transparent 50%) calc(100% - 7px) 50% / 5px 5px no-repeat,
        rgba(255, 255, 255, 0.1);
      color: #fff;
      font-size: 10px;
    }

    #preview.markgraf-embed [data-mg="speed"]:hover {
      background-color: rgba(255, 255, 255, 0.18);
    }

    #preview.markgraf-embed [data-mg="speed"] option {
      color: var(--vscode-dropdown-foreground);
      background: var(--vscode-dropdown-background);
    }

    #preview.markgraf-embed [data-mg="scrub-wrap"] {
      min-width: 0;
    }

    #preview.markgraf-embed [data-mg="ticks"] {
      left: 5px;
      right: 5px;
      height: 12px;
    }

    #preview.markgraf-embed .mg-tick {
      width: 3px;
      height: 3px;
      margin-left: -1.5px;
      margin-top: -1.5px;
      background: rgba(255, 255, 255, 0.78);
    }

    #preview.markgraf-embed [data-mg="scrub"] {
      height: 14px;
    }

    #preview.markgraf-embed [data-mg="scrub"]::-webkit-slider-runnable-track {
      height: 3px;
      margin-top: 5.5px;
      background: rgba(255, 255, 255, 0.72);
      border-radius: 999px;
    }

    #preview.markgraf-embed [data-mg="scrub"]::-webkit-slider-thumb {
      width: 11px;
      height: 11px;
      margin-top: -4px;
      background: #fff;
      border: 0;
      box-shadow: 0 1px 8px rgba(0, 0, 0, 0.28);
    }

    #preview.markgraf-embed [data-mg="scrub"]::-moz-range-track {
      height: 3px;
      background: rgba(255, 255, 255, 0.72);
      border-radius: 999px;
    }

    #preview.markgraf-embed [data-mg="scrub"]::-moz-range-thumb {
      width: 11px;
      height: 11px;
      background: #fff;
      border: 0;
      box-shadow: 0 1px 8px rgba(0, 0, 0, 0.28);
    }

    .preview-status {
      display: none;
      margin: 0 0 10px;
      padding: 8px 10px;
      border: 1px solid var(--vscode-inputValidation-warningBorder);
      border-radius: 8px;
      background: var(--vscode-inputValidation-warningBackground);
      color: var(--vscode-inputValidation-warningForeground);
      white-space: pre-wrap;
      font: 12px var(--vscode-editor-font-family);
    }

    .preview-status[data-visible="true"] {
      display: block;
    }

  </style>
</head>
<body>
  <main class="preview-shell">
    <div class="preview-toolbar" aria-label="Preview theme">
      <button class="theme-button" type="button" data-theme="light">Light</button>
      <button class="theme-button" type="button" data-theme="dark">Dark</button>
      <button class="theme-button" type="button" data-theme="blueprint">Blueprint</button>
      <button class="theme-button" type="button" data-theme="whiteboard">Whiteboard</button>
      <button class="theme-button" type="button" data-theme="isometric">Isometric</button>
    </div>
    <div id="preview-status" class="preview-status"></div>
    <div id="preview" data-markgraf-titles="false"></div>
  </main>
  <script nonce="${nonce}" type="module">
    import "${scriptUri}";

    const vscode = acquireVsCodeApi();
    const element = document.getElementById("preview");
    const status = document.getElementById("preview-status");
    const themeButtons = Array.from(document.querySelectorAll("[data-theme]"));
    const state = vscode.getState() ?? {};
    let currentSource = ${initialSource};
    let currentTheme = state.theme ?? ${JSON.stringify(defaultTheme)};
    let playbackMemory = state.playbackMemory ?? null;

    const markSelectedTheme = () => {
      for (const button of themeButtons) {
        button.setAttribute("aria-pressed", String(button.dataset.theme === currentTheme));
      }
    };

    const render = source => {
      currentSource = source;
      markSelectedTheme();
      rememberPlayback();

      const parsed = window.markgraf.tryParse(source);
      if (!parsed.ok) {
        showStatus("Preview kept at last valid frame.\n" + (parsed.error ?? "Markgraf preview failed to parse."));
        return;
      }

      hideStatus();
      element.innerHTML = "";
      element.classList.add("markgraf-embed");
      element.setAttribute("data-markgraf", "");
      element.setAttribute("data-markgraf-theme", currentTheme);
      element.setAttribute("data-markgraf-mounted", "1");
      window.markgraf.mount(element, source);
      restorePlayback();
    };

    const rememberPlayback = () => {
      const scrub = element.querySelector('[data-mg="scrub"]');
      const play = element.querySelector('[data-mg="play"]');
      const time = element.querySelector('[data-mg="time"]');
      if (!scrub || !play) {
        return;
      }

      playbackMemory = {
        scrubValue: scrub.value,
        playing: play.dataset.mgPlaying === "1",
        time: time?.textContent ?? ""
      };
      vscode.setState({ theme: currentTheme, playbackMemory });
    };

    const restorePlayback = () => {
      const memory = playbackMemory;
      if (!memory) {
        return;
      }

      requestAnimationFrame(() => {
        const scrub = element.querySelector('[data-mg="scrub"]');
        const play = element.querySelector('[data-mg="play"]');
        if (!scrub || !play) {
          return;
        }

        scrub.value = memory.scrubValue;
        scrub.dispatchEvent(new Event("input", { bubbles: true }));

        const playing = play.dataset.mgPlaying === "1";
        if (memory.playing !== playing) {
          play.click();
        }
      });
    };

    const showStatus = message => {
      status.textContent = message;
      status.dataset.visible = "true";
    };

    const hideStatus = () => {
      status.textContent = "";
      status.dataset.visible = "false";
    };

    for (const button of themeButtons) {
      button.addEventListener("click", () => {
        currentTheme = button.dataset.theme;
        rememberPlayback();
        vscode.setState({ theme: currentTheme, playbackMemory });
        render(currentSource);
      });
    }

    window.addEventListener("message", event => {
      if (event.data?.type === "source") {
        render(event.data.source);
      }
    });

    render(currentSource);
  </script>
</body>
</html>`;
};

const makeNonce = () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";

  for (let i = 0; i < 32; i++) {
    text += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  return text;
};
