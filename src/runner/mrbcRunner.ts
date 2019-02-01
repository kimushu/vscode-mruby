import * as fs from "fs";
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
    watch: boolean;
    watch_delay_ms: number;
    output?: string;
    include: string[];
    exclude: string[];
    others: string[];
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
        console.log("const:", args);
        this.options = {
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
        console.log("opt:", this.options);
        const binaryPath = path.join(
            __dirname, "..", "..", "lib", this.options.mruby_version,
            process.platform, process.arch, "mrbc"
        );
        if (process.platform === "win32") {
            this.binaryPath = binaryPath + ".exe";
        } else {
            this.binaryPath = binaryPath;
            const { mode } = fs.statSync(binaryPath);
            if ((mode & 0o111) !== 0o111) {
                // Add executable permission
                fs.chmodSync(binaryPath, mode | 0o111);
            }
        }
    }

    /**
     * Start runner.
     */
    async start(): Promise<void> {
        await this.invoke();
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
        console.log(
            sprintf("[%02d:%02d:%02d] ", now.getHours(), now.getMinutes(), now.getSeconds()) +
            sprintf(format, ...args)
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
                    this.log(`File change detected (${targets.length} file${targets.length !== 1 ? "s" : ""}). Start compilation...`);
                    const errors = await this.invoke();
                    this.log(`Found ${errors} error${errors !== 1 ? "s" : ""}. Watching for file changes.`);
                });
            }, this.options.watch_delay_ms);
        });
    }

    /**
     * Invoke "mrbc" binary.
     * @param files Files to be compiled (if omitted, options.include used)
     * @returns number of errors detected
     */
    private async invoke(files?: string[]): Promise<number> {
        if (!files) {
            // Search source files
            files = [];
            for (let include of this.options.include) {
                const found = await promisify(glob)(include, { ignore: this.options.exclude });
                files.push(...found);
            }
        }
        console.log("files:", files);

        let errors = 0;
        for (let file of files) {
            // Generate output path
            let replaced = false;
            let outputPath = file.replace(/\.rb$/i, () => {
                replaced = true;
                return ".mrb";
            });
            if (!replaced) {
                outputPath = `${file}.mrb`;
            }
            if (this.options.output) {
                outputPath = path.join(this.options.output, outputPath);
            }

            // Invoke process
            console.log("pre:", ["-o", outputPath, ...this.options.others, file]);
            const child = spawn(
                this.binaryPath,
                ["-o", outputPath, ...this.options.others, file],
                { stdio: ["ignore", "inherit", "inherit"] }
            );

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
    private binaryPath: string;
    private watcher?: chokidar.FSWatcher;
    private timer?: NodeJS.Timer;
}

// Start application
new MrbcRunner(process.argv.slice(2)).start();
