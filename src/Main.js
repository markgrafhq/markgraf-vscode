import vscode from "vscode";
import { LanguageClient, TransportKind } from "vscode-languageclient/node.js";

let client = null;

export const activateImpl = (config, context) => {
  const extensionConfig = vscode.workspace.getConfiguration();
  const command = extensionConfig.get(config.serverRuntimeSetting);
  const serverPath = extensionConfig.get(config.serverCommandSetting);

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

  context.subscriptions.push(client.start());
};

export const deactivateImpl = () => {
  const current = client;
  client = null;
  return current?.stop();
};
