import { Runtime } from "./runtime";
import { MrubyDebugSession, MrubyLaunchRequestArguments } from "./mrubyDebugSession";
import { DebugProtocol } from "vscode-debugprotocol";
import { ChildProcess } from "child_process";

export class MrubyRuntime implements Runtime {
    readonly binaryName: string = "mruby";
    readonly spawnArgs: string[];
    private cp?: ChildProcess;

    constructor(readonly debugSession: MrubyDebugSession, readonly launchArgs: MrubyLaunchRequestArguments) {
        this.spawnArgs = (launchArgs.verbose ? ["-v"] : []).concat(launchArgs.program);
    }

    async launchRequest(response: DebugProtocol.LaunchResponse, args: DebugProtocol.LaunchRequestArguments): Promise<void> {
        this.cp = this.debugSession.childProcess;
        if (!this.cp) {
            throw new Error("No mruby process");
        }
        this.cp.stdin.end();
        this.cp.stdout.on("data", (chunk) => this.debugSession.sendOutputEvent(chunk, "stdout"));
        this.cp.stderr.on("data", (chunk) => this.debugSession.sendOutputEvent(chunk, "stderr"));
    }
}
