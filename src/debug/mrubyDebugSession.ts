import { DebugSession, TerminatedEvent, OutputEvent, InitializedEvent, StoppedEvent } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { prepareBinary } from "../prepare";
import { MrubyVersion, MRUBY_LATEST_VERSION } from "../versions";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();
import { Runtime, RuntimeClass as RuntimeConstructor } from "./runtime";
import { MrdbRuntime } from "./mrdbRuntime";
import { MrubyRuntime } from "./mrubyRuntime";

export interface MrubyLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    type: "mrdb" | "mruby";
    mrubyVersion: MrubyVersion;
    program: string;
    verbose?: boolean;
}

export class MrubyDebugSession extends DebugSession {
    private runtime?: Runtime;

    protected output(message: string | Buffer, category: string = "console") {
        if (message instanceof Buffer) {
            message = new Buffer(message).toString();
        }
        this.sendEvent(new OutputEvent(message, category));
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        response.body = response.body || {};
        this.sendResponse(response);
        this.sendEvent(new InitializedEvent());
    }

    protected launchRequest(response: DebugProtocol.LaunchResponse, args: MrubyLaunchRequestArguments): void {
        Promise.resolve().then(async () => {
            if (!args.mrubyVersion) {
                args.mrubyVersion = MRUBY_LATEST_VERSION;
            }

            let runtimeConstructor: RuntimeConstructor | undefined;
            switch (args.type) {
            case "mrdb":
                runtimeConstructor = MrdbRuntime;
                break;
            case "mruby":
                runtimeConstructor = MrubyRuntime;
                break;
            }

            if (!runtimeConstructor) {
                throw new Error(`Unknown debug type: ${args.type}`);
            }

            const binaryPath = await prepareBinary(
                args.mrubyVersion, runtimeConstructor.binaryName, (title, task) => {
                    this.sendEvent(new OutputEvent(title + "\n", "console"));
                    return task();
                }
            );

            this.runtime = new runtimeConstructor(args, binaryPath);

            this.runtime.on("start", (processName, pid) => {
                this.sendEvent(new OutputEvent(
                    localize("x-process-started-with-pid-n",
                        "{0} process started (pid: ${1})",
                        processName, pid) + "\n",
                    "console"
                ));
            });

            this.runtime.on("exit", (processName, code) => {
                if (code === 0) {
                    this.sendEvent(new OutputEvent(
                        localize(
                            "x-process-finished-successfully",
                            "{0} process finished successfully",
                            processName) + "\n",
                        "console"
                    ));
                } else {
                    this.sendEvent(new OutputEvent(
                        localize(
                            "x-process-aborted-with-code-n",
                            "{0} process aborted with code {1}",
                            processName, code) + "\n",
                        "console"
                    ));
                }
                this.sendEvent(new TerminatedEvent());
            });

            for (let stream of ["stdout", "stderr", "console"]) {
                this.runtime.on(<any>stream, (chunk) => {
                    this.sendEvent(new OutputEvent(chunk, stream));
                });
            }

            this.runtime.on("stop", (reason) => {
                this.sendEvent(new StoppedEvent(reason));
            });
        }).then(() => {
            this.sendResponse(response);
        }).catch((reason) => {
            this.sendErrorResponse(response, 1000, `${reason}`);
        });
    }

    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
        if (this.runtime && this.runtime.getStackTrace) {
            this.runtime.getStackTrace(response).then(() => {
                this.sendResponse(response);
            }).catch((reason) => {
                this.sendErrorResponse(response, 1001, `${reason}`);
            });
        } else {
            this.sendResponse(response);
        }
    }
}
