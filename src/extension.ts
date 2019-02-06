import * as nls from "vscode-nls";
/*const localize = */nls.config({ messageFormat: nls.MessageFormat.file })();

import * as vscode from "vscode";
import { MrbcTaskProvider } from "./task/mrbcTaskProvider";
import { MrubyDebugger } from "./debug/mrubyDebugger";
// import { MrbViewer } from "./viewer/mrbViewer";

export function activate(context: vscode.ExtensionContext)
{
    MrbcTaskProvider.activate(context);
    // MrbViewer.activate(context);
    MrubyDebugger.activate(context);
}

export function deactivate()
{
}
