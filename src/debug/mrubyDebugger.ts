import {
    debug,
    window,
    workspace,
    CancellationToken,
    DebugAdapterDescriptor,
    DebugAdapterDescriptorFactory,
    DebugAdapterExecutable,
    DebugAdapterServer,
    DebugConfiguration,
    DebugConfigurationProvider,
    DebugSession,
    ExtensionContext,
    ProviderResult,
    WorkspaceFolder,
} from "vscode";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();
import * as path from "path";
import * as net from "net";
import { MRUBY_LATEST_VERSION } from "../versions";
import { MrubyDebugSession } from "./mrubyDebugSession";
export type MrubyDebugType = "mrdb" | "mruby";

export class MrubyDebugger implements DebugConfigurationProvider {
    /**
     * Activate debug features.
     * @param context A context of extension
     */
    static activate(context: ExtensionContext) {
        const debugTypes: MrubyDebugType[] = ["mrdb", "mruby"];
        const factory = new MrubyDebugAdapterDescriptorFactory();
        debugTypes.forEach((type) => {
            context.subscriptions.push(
                debug.registerDebugConfigurationProvider(type, new this(type)),
                debug.registerDebugAdapterDescriptorFactory(type, factory)
            );
        });
        context.subscriptions.push(factory);
    }

    /**
     * Provides initial [debug configuration](#DebugConfiguration). If more than one debug configuration provider is
     * registered for the same type, debug configurations are concatenated in arbitrary order.
     *
     * @param folder The workspace folder for which the configurations are used or `undefined` for a folderless setup.
     * @param token A cancellation token.
     * @return An array of [debug configurations](#DebugConfiguration).
     */
    provideDebugConfigurations(folder: WorkspaceFolder | undefined, token?: CancellationToken): ProviderResult<DebugConfiguration[]> {
        return [this.createLaunchConfig(folder)];
    }

    /**
     * Resolves a [debug configuration](#DebugConfiguration) by filling in missing values or by adding/changing/removing attributes.
     * If more than one debug configuration provider is registered for the same type, the resolveDebugConfiguration calls are chained
     * in arbitrary order and the initial debug configuration is piped through the chain.
     * Returning the value 'undefined' prevents the debug session from starting.
     * Returning the value 'null' prevents the debug session from starting and opens the underlying debug configuration instead.
     *
     * @param folder The workspace folder from which the configuration originates from or `undefined` for a folderless setup.
     * @param debugConfiguration The [debug configuration](#DebugConfiguration) to resolve.
     * @param token A cancellation token.
     * @return The resolved debug configuration or undefined or null.
     */
    async resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfiguration: DebugConfiguration, token?: CancellationToken): Promise<DebugConfiguration | undefined> {
        let config = debugConfiguration;
        try {
            if (!config.type && !config.request && !config.name) {
                config = this.createLaunchConfig(folder, true);
                if (!config.program) {
                    throw new Error(localize("cannot-find-program", "Cannot find a program to debug"));
                }
            }

            if (!config.cwd && folder) {
                config.cwd = folder.uri.fsPath;
            }
            if (!config.cwd && workspace.workspaceFolders &&
                    workspace.workspaceFolders.length > 0) {
                config.cwd = workspace.workspaceFolders[0].uri.fsPath;
            }
            if (!config.cwd && config.program === "${file}") {
                config.cwd = "${fileDirname}";
            }
            if (!config.cwd && config.program && path.isAbsolute(config.program)) {
                config.cwd = path.dirname(config.program);
            }
            if (!config.cwd) {
                config.cwd = "${workspaceFolder}";
            }
            return config;
        } catch (error) {
            await window.showErrorMessage(error.message, { modal: true });
            return undefined;
        }
    }

    private createLaunchConfig(folder?: WorkspaceFolder, resolve?: boolean): DebugConfiguration {
        const config: DebugConfiguration = {
            type: this.debugType,
            request: "launch",
            name: "unknown"
        };
        switch (this.debugType) {
        case "mrdb":
            config.name = localize("mrdb.launch.config.name",
                "Launch program in mruby debugger (mrdb)");
            break;
        case "mruby":
            config.name = localize("mruby.launch.config.name",
                "Launch program in mruby");
            break;
        }
        let program: string | undefined;
        const editor = window.activeTextEditor;
        if (editor && editor.document.languageId === "ruby") {
            const { uri } = editor.document;
            const workspaceFolder = workspace.getWorkspaceFolder(uri);
            if (workspaceFolder === folder) {
                program = workspace.asRelativePath(uri);
                if (!path.isAbsolute(program)) {
                    program = `\${workspaceFolder}/${program}`;
                }
            }
        }
        if ((!resolve) && (!program)) {
            program = "${file}";
        }
        if (program) {
            config.program = program;
        }

        config.mrubyVersion = MRUBY_LATEST_VERSION;
        return config;
    }

    private constructor(readonly debugType: MrubyDebugType) {
    }
}

class MrubyDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory {
    private server?: net.Server;

    /**
     * 'createDebugAdapterDescriptor' is called at the start of a debug session to provide details about the debug adapter to use.
     * These details must be returned as objects of type [DebugAdapterDescriptor](#DebugAdapterDescriptor).
     * Currently two types of debug adapters are supported:
     * - a debug adapter executable is specified as a command path and arguments (see [DebugAdapterExecutable](#DebugAdapterExecutable)),
     * - a debug adapter server reachable via a communication port (see [DebugAdapterServer](#DebugAdapterServer)).
     * @param session The [debug session](#DebugSession) for which the debug adapter will be used.
     * @param executable The debug adapter's executable information as specified in the package.json (or undefined if no such information exists).
     * @return a [debug adapter descriptor](#DebugAdapterDescriptor) or undefined.
     */
    createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable | undefined): ProviderResult<DebugAdapterDescriptor> {
        const { DEBUG_SERVER_PORT } = process.env;
        if (DEBUG_SERVER_PORT) {
            return new DebugAdapterServer(parseInt(DEBUG_SERVER_PORT));
        }

        if (!this.server) {
            this.server = net.createServer((socket) => {
                const session = new MrubyDebugSession();
                session.setRunAsServer(true);
                session.start(socket, socket);
            }).listen();
        }

        return new DebugAdapterServer(this.server.address().port);
    }

    /**
     * Dispose object.
     */
    dispose() {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
    }
}
