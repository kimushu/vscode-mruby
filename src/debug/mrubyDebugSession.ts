import { DebugSession, TerminatedEvent, OutputEvent, InitializedEvent } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { prepareBinary } from "../prepare";
import { MrubyVersion, MRUBY_LATEST_VERSION } from "../versions";
import { spawn, ChildProcess } from "child_process";
import * as nls from "vscode-nls";
import { Runtime } from "./runtime";
import { MrdbRuntime } from "./mrdbRuntime";
import { MrubyRuntime } from "./mrubyRuntime";
const localize = nls.loadMessageBundle();

export interface MrubyLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    type: "mrdb" | "mruby";
    mrubyVersion: MrubyVersion;
    program: string;
    verbose?: boolean;
}

export class MrubyDebugSession extends DebugSession {
    public childProcess?: ChildProcess;
    private runtime?: Runtime;

    sendOutputEvent(message: string | Buffer, category: string = "console") {
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
            switch (args.type) {
            case "mruby":
                this.runtime = new MrubyRuntime(this, args);
                break;
            case "mrdb":
                this.runtime = new MrdbRuntime(this, args);
                break;
            default:
                throw new Error(`Unknown debug type: ${args.type}`);
            }

            const binaryPath = await prepareBinary(
                args.mrubyVersion, this.runtime.binaryName, (title, task) => {
                    this.sendEvent(new OutputEvent(title + "\n", "console"));
                    return task();
                }
            );

            this.childProcess = spawn(binaryPath, this.runtime.spawnArgs, { stdio: "pipe" });
            if (!this.childProcess.pid) {
                throw new Error(`Cannot invoke debug process: ${binaryPath}`);
            }
            this.sendOutputEvent(
                localize("x-process-started-with-pid-n",
                    "{0} process started (pid: {1})",
                    this.runtime.binaryName, this.childProcess.pid) + "\n",
                "console"
            );
            this.childProcess.on("exit", (code) => {
                if (code === 0) {
                    this.sendOutputEvent(
                        localize(
                            "x-process-finished-successfully",
                            "{0} process finished successfully",
                            this.runtime!.binaryName) + "\n",
                        "console"
                    );
                } else {
                    this.sendOutputEvent(
                        localize(
                            "x-process-aborted-with-code-n",
                            "{0} process aborted with code {1}",
                            this.runtime!.binaryName, code) + "\n",
                        "console"
                    );
                }
                this.sendEvent(new TerminatedEvent());
            });
            if (this.runtime.launchRequest) {
                return this.runtime.launchRequest(response, args);
            }
        }).then(() => {
            this.sendResponse(response);
        }).catch((reason) => {
            this.sendErrorResponse(response, 1000, `${reason}`);
        });
    }

    protected transferRequest(requestName: keyof Runtime, response: DebugProtocol.Response, ...args: any[]): void {
        Promise.resolve().then(() => {
            if (!this.runtime) {
                throw new Error("No runtime instance");
            }
            const req: Function = <any>this.runtime[requestName];
            if (req) {
                return req.call(this.runtime, response, ...args);
            }
        }).then(() => {
            this.sendResponse(response);
        }).catch((reason) => {
            this.sendErrorResponse(response, 1000, `${reason}`);
        });
    }

    threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        this.transferRequest("threadsRequest", response);
    }

    stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
        this.transferRequest("stackTraceRequest", response, args);
    }

    scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
        this.transferRequest("scopesRequest", response, args);
    }

    nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        this.transferRequest("nextRequest", response, args);
    }

    stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
        this.transferRequest("stepInRequest", response, args);
    }

    variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
        this.transferRequest("variablesRequest", response, args);
    }

    evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        this.transferRequest("evaluateRequest", response, args);
    }

    convertPath(debuggerPath: string): string {
        return this.convertDebuggerPathToClient(debuggerPath);
    }
}
