import { MrubyLaunchRequestArguments } from "./mrubyDebugSession";
import { DebugProtocol } from "vscode-debugprotocol";

export interface Runtime {
    on(event: "start", listener: (processName: string, pid: number) => void): void;
    on(event: "exit", listener: (processName: string, code: number) => void): void;
    on(event: "stop", listener: (reason: string) => void): void;
    on(event: "stdout", listener: (chunk: Buffer | string) => void): void;
    on(event: "stderr", listener: (chunk: Buffer | string) => void): void;
    on(event: "console", listener: (chunk: Buffer | string) => void): void;
    getStackTrace?(response: DebugProtocol.StackTraceResponse): Promise<void>;
}

export interface RuntimeClass {
    readonly binaryName: string;
    new (launchArgs: MrubyLaunchRequestArguments, binaryPath: string): Runtime;
}
