import { DebugProtocol } from "vscode-debugprotocol";

export interface Runtime {
    binaryName: string;
    spawnArgs: string[];

    // dispatchRequest?(request: DebugProtocol.Request): Promise<void>;
    // disconnectRequest?(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): Promise<void>;
    launchRequest?(response: DebugProtocol.LaunchResponse, args: DebugProtocol.LaunchRequestArguments): Promise<void>;
    // attachRequest?(response: DebugProtocol.AttachResponse, args: DebugProtocol.AttachRequestArguments): Promise<void>;
    // terminateRequest?(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments): Promise<void>;
    // restartRequest?(response: DebugProtocol.RestartResponse, args: DebugProtocol.RestartArguments): Promise<void>;
    // setBreakPointsRequest?(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void>;
    // setFunctionBreakPointsRequest?(response: DebugProtocol.SetFunctionBreakpointsResponse, args: DebugProtocol.SetFunctionBreakpointsArguments): Promise<void>;
    // setExceptionBreakPointsRequest?(response: DebugProtocol.SetExceptionBreakpointsResponse, args: DebugProtocol.SetExceptionBreakpointsArguments): Promise<void>;
    // configurationDoneRequest?(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): Promise<void>;
    // continueRequest?(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): Promise<void>;
    nextRequest?(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): Promise<void>;
    stepInRequest?(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): Promise<void>;
    // stepOutRequest?(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): Promise<void>;
    // stepBackRequest?(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): Promise<void>;
    // reverseContinueRequest?(response: DebugProtocol.ReverseContinueResponse, args: DebugProtocol.ReverseContinueArguments): Promise<void>;
    // restartFrameRequest?(response: DebugProtocol.RestartFrameResponse, args: DebugProtocol.RestartFrameArguments): Promise<void>;
    // gotoRequest?(response: DebugProtocol.GotoResponse, args: DebugProtocol.GotoArguments): Promise<void>;
    // pauseRequest?(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments): Promise<void>;
    // sourceRequest?(response: DebugProtocol.SourceResponse, args: DebugProtocol.SourceArguments): Promise<void>;
    threadsRequest?(response: DebugProtocol.ThreadsResponse): Promise<void>;
    // terminateThreadsRequest?(response: DebugProtocol.TerminateThreadsResponse, args: DebugProtocol.TerminateThreadsRequest): Promise<void>;
    stackTraceRequest?(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): Promise<void>;
    scopesRequest?(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): Promise<void>;
    variablesRequest?(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): Promise<void>;
    // setVariableRequest?(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments): Promise<void>;
    // setExpressionRequest?(response: DebugProtocol.SetExpressionResponse, args: DebugProtocol.SetExpressionArguments): Promise<void>;
    evaluateRequest?(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): Promise<void>;
    // stepInTargetsRequest?(response: DebugProtocol.StepInTargetsResponse, args: DebugProtocol.StepInTargetsArguments): Promise<void>;
    // gotoTargetsRequest?(response: DebugProtocol.GotoTargetsResponse, args: DebugProtocol.GotoTargetsArguments): Promise<void>;
    // completionsRequest?(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments): Promise<void>;
    // exceptionInfoRequest?(response: DebugProtocol.ExceptionInfoResponse, args: DebugProtocol.ExceptionInfoArguments): Promise<void>;
    // loadedSourcesRequest?(response: DebugProtocol.LoadedSourcesResponse, args: DebugProtocol.LoadedSourcesArguments): Promise<void>;
}
