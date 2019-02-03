import * as fs from "fs-extra";
import * as chokidar from "chokidar";
import { sprintf } from "sprintf-js";
import * as path from "path";
import * as glob from "glob";
import { promisify } from "util";
import { spawn } from "child_process";
import { MrubyVersions } from "../versions";

const DEFAULT_WATCH_DELAY_MS = 1000;

/**
 * Options for MrbcRunner
 */
interface MrbcRunnerOptions {
    mruby_version?: string;
    binary_path: string;
    watch: boolean;
    watch_delay_ms: number;
    output?: string;
    include: string[];
    exclude: string[];
    others: string[];
}

/**
 * Make number-indicating text with singular or plural form in English
 * @param value A number
 * @param word The base of word
 */
function plural(value: number, word: string): string {
    if (value === 1) {
        return `${value} ${word}`;
    } else {
        return `${value} ${word}s`;
    }
}

/**
 * Runner for mrbc binary with watch mode
 */
class MrbcRunner {
    /**
     * Construct MrbcRunner.
     * @param args List of options (excludes node itself and script path)
     */
    constructor(args: string[]) {
        this.options = {
            binary_path: "mrbc",
            watch: false,
            watch_delay_ms: DEFAULT_WATCH_DELAY_MS,
            include: [],
            exclude: [],
            others: [],
        };
        this.parseOptions(args);
        if (!this.options.mruby_version) {
            // Use latest version
            this.options.mruby_version = MrubyVersions[MrubyVersions.length - 1];
        }
    }

    /**
     * Start runner.
     */
    async start(): Promise<void> {
        await this.invoke(undefined, true);
        if (this.options.watch) {
            this.watch();
        }
    }

    /**
     * Output log.
     * @param format Format string (sprintf style)
     * @param args Values for sprintf
     */
    private log(format: string, ...args: any[]): void {
        const now = new Date();
        process.stdout.write(
            sprintf("[%02d:%02d:%02d] ", now.getHours(), now.getMinutes(), now.getSeconds()) +
            sprintf(format, ...args) + "\n"
        );
    }

    /**
     * Start watching.
     */
    private watch(): void {
        let promise = Promise.resolve();
        let pending: string[] = [];
        this.watcher = chokidar.watch(this.options.include, {ignored: this.options.exclude});
        this.watcher.on("change", (path) => {
            pending.push(path);
            if (this.timer) {
                this.timer.unref();
            }
            this.timer = setTimeout(() => {
                promise = promise.then(async () => {
                    if (pending.length === 0) {
                        return;
                    }
                    const targets = pending;
                    pending = [];
                    this.log(`File change detected (${plural(targets.length, "file")}). Start compilation...`);
                    await this.invoke(targets, true);
                });
            }, this.options.watch_delay_ms);
        });
    }

    /**
     * Invoke "mrbc" binary.
     * @param files Files to be compiled (if omitted, options.include used)
     * @returns number of errors detected
     */
    private async invoke(files?: string[], watch?: boolean): Promise<number> {
        if (!files) {
            // Search source files
            files = [];
            for (let include of this.options.include) {
                const found = await promisify(glob)(include, { ignore: this.options.exclude });
                files.push(...found);
            }
        }

        let errors = 0;
        const suffix = this.options.others.find((opt) => opt.startsWith("-B")) ? ".c" : ".mrb";
        for (let file of files) {
            // Generate output path
            let replaced = false;
            let outputPath = file.replace(/\.rb$/i, () => {
                replaced = true;
                return suffix;
            });
            if (!replaced) {
                outputPath = `${file}${suffix}`;
            }
            if (this.options.output) {
                outputPath = path.join(this.options.output, outputPath);
            }

            // Ensure output directory
            fs.ensureDirSync(path.dirname(outputPath));

            // Invoke process
            const child = spawn(
                this.options.binary_path,
                ["-o", outputPath, ...this.options.others, file],
                { stdio: ["ignore", "pipe", "pipe"] }
            );
            child.stdout.on("data", (chunk) => process.stdout.write(chunk));
            child.stderr.on("data", (chunk) => process.stderr.write(chunk));

            // Wait for completion
            await new Promise<void>((resolve) => {
                child.on("exit", (code) => {
                    if (code !== 0) {
                        ++errors;
                    }
                    resolve();
                });
            });
        }

        if (watch) {
            this.log(`Found ${plural(errors, "error")}. Watching for file changes.`);
        }
        return errors;
    }

    /**
     * Parse command line options.
     * @param args List of options (excludes node itself and script path)
     */
    private parseOptions(args: string[]): void {
        for (let index = 0; index < args.length; ++index) {
            const arg = args[index];
            if (arg.startsWith("@")) {
                const unlink = arg.startsWith("@-");
                const paramFile = arg.slice(unlink ? 2 : 1);
                const paramData = fs.readFileSync(paramFile, "utf8");
                args.splice(index--, 1, ...paramData.split("\n").map((v) => v.trim()));
                if (unlink) {
                    fs.unlinkSync(paramFile);
                }
                continue;
            }
            switch (arg) {
            case "--mruby-version":
                this.options.mruby_version = args[++index];
                break;
            case "--binary-path":
                this.options.binary_path = args[++index];
                break;
            case "--watch":
                this.options.watch = true;
                break;
            case "--watch-delay":
                this.options.watch_delay_ms = parseInt(args[++index]);
                break;
            case "--output":
                this.options.output = args[++index];
                break;
            case "--include":
                for (;;) {
                    const file = args[index + 1];
                    if (!file || file.startsWith("-")) {
                        break;
                    }
                    this.options.include.push(file);
                    ++index;
                }
                break;
            case "--exclude":
                for (;;) {
                    const file = args[index + 1];
                    if (!file || file.startsWith("-")) {
                        break;
                    }
                    this.options.exclude.push(file);
                    ++index;
                }
                break;
            default:
                this.options.others.push(arg);
                break;
            }
        }
    }

    private options: MrbcRunnerOptions;
    private watcher?: chokidar.FSWatcher;
    private timer?: NodeJS.Timer;
}

// Start application
new MrbcRunner(process.argv.slice(2)).start();
