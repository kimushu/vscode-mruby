import { Runtime } from "./runtime";
import { MrubyDebugSession, MrubyLaunchRequestArguments } from "./mrubyDebugSession";
import { DebugProtocol } from "vscode-debugprotocol";
import { ChildProcess } from "child_process";
import { Thread, StackFrame, Source, StoppedEvent, Scope, Handles } from "vscode-debugadapter";
import * as path from "path";
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();

const THREAD_ID = 1;
const FRAME_ID = 1;

function parseRubyExpr(expr: string): any {
    function skipSpaces() {
        expr = expr.replace(/^[ \t\r\n]+/, "");
    }
    function doParse(): any {
        skipSpaces();
        switch (expr[0]) {
        case "[":
            // Array
            expr = expr.slice(1);
            const result = new Array<any>();
            for (;;) {
                const item = doParse();
                if (item !== undefined) {
                    result.push(item);
                }
                skipSpaces();
                switch (expr[0]) {
                case "]":
                    expr = expr.slice(1);
                    return result;
                case ",":
                    if (item !== undefined) {
                        expr = expr.slice(1);
                        continue;
                    }
                default:
                    throw new Error("Invalid array syntax");
                }
            }
        case ":":
            // Symbol
            const sym_match = expr.match(/^:((?:@|@@|\$)?(?:\w+|\/)[!?=]?)/);
            if (sym_match) {
                const str = sym_match[1];
                expr = expr.slice(sym_match[0].length);
                return str;
            }
            throw new Error("Invalid symbol syntax");
        }
    }
    const result = doParse();
    skipSpaces();
    if (expr === "") {
        return result;
    }
    throw new Error("Junk data after expression");
}

export class MrdbRuntime implements Runtime {
    readonly binaryName: string = "mrdb";
    readonly spawnArgs: string[];
    private cp?: ChildProcess;
    private stopped?: boolean;
    private finished?: boolean;
    private processPrompt?: (data: string, file: string, line: number) => void;
    private location?: {
        file: string;
        line: number;
    };
    private variableHandles = new Handles<string>();

    constructor(readonly debugSession: MrubyDebugSession, readonly launchArgs: MrubyLaunchRequestArguments) {
        this.spawnArgs = (launchArgs.verbose ? ["-v"] : []).concat(launchArgs.program);
    }

    async launchRequest(response: DebugProtocol.LaunchResponse, args: DebugProtocol.LaunchRequestArguments): Promise<void> {
        this.cp = this.debugSession.childProcess;
        if (!this.cp) {
            throw new Error("No mrdb process");
        }
        this.processPrompt = this.processStepResponse;
        this.cp.stdout.on("data", (chunk) => {
            const prompt = chunk.toString();
            const match = prompt.match(/\((.*):(\d+)\) $/);
            if (!match) {
                this.debugSession.sendOutputEvent(prompt, "stdout");
                return;
            }
            const file = match[1];
            const line = parseInt(match[2]);
            const data = match.index ? prompt.slice(0, match.index) : "";
            if (this.processPrompt) {
                this.processPrompt(data, file, line);
            }
        });
        this.cp.stderr.on("data", (chunk) => this.debugSession.sendOutputEvent(chunk, "stderr"));
    }

    async threadsRequest(response: DebugProtocol.ThreadsResponse): Promise<void> {
        console.log("threadsRequest");
        response.body = {
            threads: [
                new Thread(THREAD_ID, "Main")
            ]
        };
    }

    async stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): Promise<void> {
        console.log("stackTraceRequest");
        response.body = {
            stackFrames: [],
            totalFrames: 0,
        };
        if (!this.location) {
            return;
        }
        response.body.totalFrames = 1;
        response.body.stackFrames.push(
            new StackFrame(FRAME_ID, "main", new Source(
                path.basename(this.location.file),
                this.debugSession.convertPath(this.location.file)
            ), this.location.line)
        );
    }

    async scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): Promise<void> {
        if (args.frameId !== FRAME_ID) {
            return;
        }
        const scopes = new Array<DebugProtocol.Scope>();
        scopes.push(new Scope(localize("local", "Local"), this.variableHandles.create("local"), false));
        scopes.push(new Scope(localize("global", "Global"), this.variableHandles.create("global"), true));
        response.body = { scopes };
    }

    async variablesRequest?(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): Promise<void> {
        const variables = new Array<DebugProtocol.Variable>();
        if (!this.stopped || this.finished) {
            return;
        }
        const id = this.variableHandles.get(args.variablesReference);
        let idPrefix = "";
        let exprPrefix = "";
        let exprSuffix = "";
        let names: string[];
        if (id === "local") {
            // Local variables not supported yet...
            names = [];
        } else if (id === "global") {
            names = parseRubyExpr(await this.evaluate("global_variables"));
        } else {
            idPrefix = `${id}.`;
            const expr = id.replace(/\.([^\.]+)/g, (_, m) => `.instance_variable_get(:${m}).`);
            names = parseRubyExpr(await this.evaluate(`${expr}.instance_variables`));
            exprPrefix = `${expr}.instance_variable_get(:`;
            exprSuffix = ")";
        }
        for (let name of names) {
            const expr = `${exprPrefix}${name}${exprSuffix}`;
            const value = await this.evaluate(expr);
            const klass = await this.evaluate(`${expr}.class`);
            const variablesReference = value.startsWith("#") ?
                this.variableHandles.create(idPrefix + name) : 0;
            variables.push({ name, value, variablesReference, type: klass });
        }
        response.body = { variables };
    }

    async nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): Promise<void> {
        return this.stepInRequest(response, args);
    }

    async stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): Promise<void> {
        if (this.stopped && !this.finished) {
            this.processPrompt = this.processStepResponse;
            this.cp!.stdin.write("step\n");
            this.stopped = false;
        }
    }

    evaluate(expr: string): Promise<string> {
        const promise = new Promise<string>((resolve, reject) => {
            this.processPrompt = (...args) => {
                try {
                    resolve(this.processEvalResponse(...args));
                } catch (reason) {
                    reject(reason);
                }
            };
        });
        this.cp!.stdin.write(`eval ${expr}\n`);
        return promise;
    }

    async evaluateRequest?(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): Promise<void> {
        if (this.stopped && !this.finished) {
            const _type = await this.evaluate(`(${args.expression}).class`);
            const match = _type.match(/^\(eval\):\d+: (.*)$/);
            if (match) {
                throw match[1];
            } else {
                const result = await this.evaluate(`(${args.expression})`);
                response.body = { type: _type, result, variablesReference: 0 };
            }
        }
    }

    protected processEvalResponse(data: string, file: string, line: number): string {
        const match = data.match(/^\$\d+ = (.+)/);
        if (match) {
            return match[1];
        }
        throw new Error("Evaluation error");
    }

    protected processStepResponse(data: string, file: string, line: number) {
        if ((file === "-") && (line === 0)) {
            this.finished = true;
            this.cp!.stdin.write("quit\n");
            return;
        }
        if ((data !== "") && (!data.startsWith(`${file}:${line}`))) {
            this.debugSession.sendOutputEvent(`Unknown response from mrdb: ${JSON.stringify(data)}\n`);
            return;
        }
        const reason = this.location ? "step" : "entry";
        this.location = { file, line };
        this.debugSession.sendEvent(new StoppedEvent(reason, THREAD_ID));
        this.stopped = true;
    }

}
