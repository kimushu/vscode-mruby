import { Runtime } from "./runtime";
import { MrubyLaunchRequestArguments } from "./mrubyDebugSession";
import { EventEmitter } from "events";
import { spawn, ChildProcess } from "child_process";

export class MrubyRuntime extends EventEmitter implements Runtime {
    static readonly binaryName: string = "mruby";
    protected cp: ChildProcess;

    constructor(readonly launchArgs: MrubyLaunchRequestArguments, binaryPath: string) {
        super();

        this.cp = spawn(binaryPath, [], { stdio: "pipe" });
        if (!this.cp.pid) {
            throw new Error(`Cannot spawn process: "${binaryPath}"`);
        }
        this.emitAfter("start", new.target.binaryName, this.cp.pid);
        this.cp.on("exit", (code) => {
            this.emitAfter("exit", new.target.binaryName, code);
        });
        this.cp.stdout.on("data", (chunk: Buffer) => {
            this.emitAfter("stdout", chunk);
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
}
