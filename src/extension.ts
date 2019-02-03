import * as nls from "vscode-nls";
/* const localize = */nls.config({ messageFormat: nls.MessageFormat.file })();

import * as vscode from "vscode";
import { MrbcTaskProvider } from "./task/mrbcTaskProvider";

export function activate(context: vscode.ExtensionContext)
{
    MrbcTaskProvider.activate(context);
}

export function deactivate()
{
}
