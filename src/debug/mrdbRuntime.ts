import { Runtime } from "./runtime";
import { MrubyLaunchRequestArguments } from "./mrubyDebugSession";
import { EventEmitter } from "events";
import { ChildProcess, spawn } from "child_process";
import { DebugProtocol } from "vscode-debugprotocol";


export class MrdbRuntime extends EventEmitter implements Runtime {
    static readonly binaryName: string = "mrdb";
    protected cp: ChildProcess;
    protected stopped: boolean = false;
    protected onEntry: boolean = true;
    protected source: string = "";
    protected line: number = 0;

    constructor(readonly launchArgs: MrubyLaunchRequestArguments, binaryPath: string) {
        super();

        const args: string[] = [launchArgs.program];
        this.cp = spawn(binaryPath, args, { stdio: "pipe" });
        if (!this.cp.pid) {
            throw new Error(`Cannot spawn process: "${binaryPath}"`);
        }
        this.emitAfter("start", new.target.binaryName, this.cp.pid);
        this.cp.on("exit", (code) => {
            this.emitAfter("exit", new.target.binaryName, code);
        });
        this.cp.stdout.on("data", (chunk: Buffer) => {
            this.processPrompt(chunk.toString());
        });
        this.cp.stderr.on("data", (chunk: Buffer) => {
            this.emitAfter("stderr", chunk);
        });
    }

    protected emitAfter(event: string, ...args: any[]) {
        setImmediate(() => {
            this.emit(event, ...args);
        });
    }

    protected processPrompt(prompt: string) {
        const match = prompt.match(/^\((.+):(\d+)\) $/);
        if (!match) {
            this.emitAfter("console", `Unknown prompt: "${prompt}"\n`);
            return;
        }

        const file = match[1];
        const line = parseInt(match[2]);
        this.source = file;
        this.line = line;
        this.emitAfter("stop", this.onEntry ? "entry" : "step");
        this.onEntry = false;
    }

    async getStackTrace(response: DebugProtocol.StackTraceResponse): Promise<void> {
        response.body.stackFrames = [{
            id: 0,
            name: "stack",
            source: { path: this.source },
            line: this.line,
            column: 1,
        }];
        response.body.totalFrames = 1;
    }
}
