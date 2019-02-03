import {
    commands,
    window,
    workspace,
    CancellationToken,
    ExtensionContext,
    TextDocumentContentProvider,
    Uri,
} from "vscode";
import * as fs from "fs-extra";
import * as nls from "vscode-nls";
/*const localize = */nls.loadMessageBundle();
import * as dedent from "dedent";

export class MrbViewer implements TextDocumentContentProvider {
    static readonly scheme = "mruby-mrb";

    static activate(context: ExtensionContext) {
        context.subscriptions.push(
            commands.registerCommand("mruby.mrbviewer.open", this.openCommandHandler),
            workspace.registerTextDocumentContentProvider(
                this.scheme, new MrbViewer()
            )
        );
    }

    /**
     * Provide textual content for a given uri.
     *
     * The editor will use the returned string-content to create a readonly
     * [document](#TextDocument). Resources allocated should be released when
     * the corresponding document has been [closed](#workspace.onDidCloseTextDocument).
     *
     * **Note**: The contents of the created [document](#TextDocument) might not be
     * identical to the provided text due to end-of-line-sequence normalization.
     *
     * @param uri An uri which scheme matches the scheme this provider was [registered](#workspace.registerTextDocumentContentProvider) for.
     * @param token A cancellation token.
     * @return A string or a thenable that resolves to such.
     */
    async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string> {
        const mrbPath = uri.fsPath;
        const bytes = await fs.readFile(mrbPath);
        const header = bytes.slice(0, 8).toString();
        switch (header) {
        case "RITE0001":
        case "RITE0002":
        case "RITE0003":
            return dedent`
            ---
            error: "This mrb viewer does not support RITE0001~0003."
            `;
        case "RITE0004":
            return this.decodeRite0004(bytes);
        case "RITE0005":
            return this.decodeRite0005(bytes);
        default:
            return dedent`
            ---
            error: "Unknown header!"
            `;
        }
    }

    private decodeRite0004(bytes: Buffer): string {
        return "";
    }

    private decodeRite0005(bytes: Buffer): string {
        return "";
    }

    private static openCommandHandler(uri?: Uri): void {
        if (!uri) {
            return;
        }
        window.showTextDocument(uri.with({ scheme: MrbViewer.scheme }));
    }

    private constructor() {
    }
}