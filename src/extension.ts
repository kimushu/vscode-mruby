import * as vscode from 'vscode';
import { MrbcTaskProvider } from './task/mrbcTaskProvider';

export function activate(context: vscode.ExtensionContext)
{
    MrbcTaskProvider.activate(context);
}

export function deactivate()
{
}
