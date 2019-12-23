import { spawn, SpawnOptions } from "child_process";
import { existsSync, writeFile, readFile } from "fs-extra";
import * as glob from "glob";
import { LZMA } from "lzma-native";
import * as path from "path";
import { SemVer } from "semver";
import * as ssh2 from "ssh2";
import { WritableStreamBuffer } from "stream-buffers";
import * as tarStream from "tar-stream";
import { promisify } from "util";

type MRubyVersion = "1.4.1" | "2.0.0" | "2.0.1" | "2.1.0";
type MRubyArch = "x64" | "ia32";

const EXT_VERSION: string = require(path.join(__dirname, "package.json")).version;

function spawnPromise(command: string, args: string[], options: SpawnOptions = {}): Promise<void> {
    const child = spawn(command, args, Object.assign({stdio: "inherit"}, options));
    return new Promise((resolve, reject) => {
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command (${command}) failed with code: ${code}`));
            }
        });
    });
}

class MRubyRepository {
    private clonedDir?: string;
    private readonly gitCommand = "git";
    private readonly gitUrl = "https://github.com/mruby/mruby.git";

    async clone(dir: string): Promise<void> {
        const fullPath = path.resolve(dir);
        if (!existsSync(fullPath)) {
            await spawnPromise(this.gitCommand,
                ["clone", this.gitUrl, fullPath]);
        }
        this.clonedDir = fullPath;
    }

    private spawnGit(...args: string[]): Promise<void> {
        if (!this.clonedDir) {
            throw new Error("Not cloned");
        }
        return spawnPromise(this.gitCommand, ["-C", this.clonedDir].concat(...args));
    }

    checkout(version: string): Promise<void> {
        return this.spawnGit("checkout", "--force", version);
    }

    clean(): Promise<void> {
        return this.spawnGit("clean", "-d", "-f", "-q", "-x");
    }

    get dir(): string {
        if (!this.clonedDir) {
            throw new Error("Not cloned");
        }
        return this.clonedDir;
    }
}

class Uploader {
    private readonly host: string;
    private readonly port: number;
    private readonly user: string;
    private readonly identity: string;
    private readonly dest: string;

    constructor() {
        this.host = process.env.SFTP_HOST!;
        if (!this.host) {
            throw new Error("SFTP_HOST required");
        }
        this.port = parseInt(process.env.SFTP_PORT || "22");
        if (isNaN(this.port)) {
            throw new Error("SFTP_PORT required");
        }
        this.user = process.env.SFTP_USER!;
        if (!this.user) {
            throw new Error("SFTP_USER required");
        }
        this.identity = process.env.SFTP_IDENTITY!;
        if (!this.identity) {
            throw new Error("SFTP_IDENTITY required");
        }
        this.dest = process.env.SFTP_DEST!;
        if (!this.dest) {
            throw new Error("SFTP_DEST required");
        }
    }

    async upload(files: string[], remoteDir?: string): Promise<void> {
        const client = new ssh2.Client();
        const connection = new Promise((resolve, reject) => {
            client.on("ready", resolve);
            client.on("error", reject);
        });
        client.connect({
            host: this.host,
            port: this.port,
            username: this.user,
            privateKey: await readFile(this.identity)
        });
        console.log("Connecting to server ...");
        await connection;
        try {
            console.log("Starting SFTP session ...");
            const sftp = await promisify(client.sftp).call(client) as ssh2.SFTPWrapper;
            if (remoteDir) {
                remoteDir = `${this.dest}/${remoteDir}`;
            } else {
                remoteDir = this.dest;
            }
            console.log(`Making remote directory ...`);
            try {
                await promisify(sftp.mkdir).call(sftp, {mode: 0o777}, remoteDir);
            } catch {
                // Ignore errors on mkdir
            }
            const fastPut = promisify(sftp.fastPut).bind(sftp);
            for (let file of files) {
                console.log(`Uploading ${file} ...`);
                await fastPut(file, `${remoteDir}/${path.basename(file)}`);
            }
        } finally {
            console.log("Closing ...");
            client.end();
        }
    }
}

class Builder {
    private readonly workDir: string;
    private readonly mrubyVersion: MRubyVersion;
    private readonly platform: NodeJS.Platform;
    private readonly archList: MRubyArch[];
    private readonly suffix: string = "";
    private readonly rubyCommand: string = "ruby";
    private readonly stripCommand: string = "strip";
    private repo: MRubyRepository;
    private readonly uploader?: Uploader;

    constructor(workDir: string = ".") {
        this.workDir = path.resolve(workDir);
        this.mrubyVersion = process.env.MRUBY_VERSION as MRubyVersion;
        if (!this.mrubyVersion) {
            throw new Error("MRUBY_VERSION required");
        }
        this.platform = process.platform;
        switch (this.platform) {
        case "win32":
            this.archList = [process.env.MRUBY_ARCH as MRubyArch];
            if (!this.archList[0]) {
                throw new Error("MRUBY_ARCH required");
            }
            this.suffix = ".exe";
            break;
        case "darwin":
            this.archList = ["x64"];
            break;
        case "linux":
            this.archList = ["x64", "ia32"];
            break;
        default:
            throw new Error(`Unsupported platform: ${this.platform}`);
        }
        try {
            this.uploader = new Uploader();
        } catch (error) {
            console.error(error);
            console.warn("Warning: Uploading disabled");
        }
    }

    async run(): Promise<void> {
        console.log("-------- Build information --------");
        console.log(`mruby Version: ${this.mrubyVersion}`);
        console.log(`Platform: ${this.platform}`);
        console.log(`Arch: ${this.archList.join(", ")}`);
        await this.checkout();
        for (let arch of this.archList) {
            if (await this.isDone(arch)) {
                console.log(`-------- Skip build (${arch}) --------`);
                continue;
            }
            await this.build(arch);
            await this.package(arch);
            await this.upload(arch);
        }
    }

    async checkout(): Promise<void> {
        console.log("-------- Checking out repository --------");
        this.repo = new MRubyRepository();
        await this.repo.clone(path.join(this.workDir, "mruby"));
        await this.repo.checkout(this.mrubyVersion);
        await this.repo.clean();
    }

    async isDone(arch: MRubyArch): Promise<boolean> {
        const verPath = this.getLzmaPath(arch) + ".version";
        try {
            const version = new SemVer((await readFile(verPath, "utf-8")).trim());
            if (version.compare(EXT_VERSION) >= 0) {
                return true;
            }
        } catch {
        }
        return false;
    }

    async build(arch: MRubyArch): Promise<void> {
        console.log(`-------- Building mruby (${arch}) --------`);
        let env = Object.assign({}, process.env);
        if ((this.platform !== "win32") && (arch === "ia32")) {
            env.CFLAGS = "-m32";
            env.LDFLAGS = "-m32";
        }
        await spawnPromise(this.rubyCommand, ["./minirake"], {
            cwd: this.repo.dir,
            env
        });
    }

    async package(arch: MRubyArch): Promise<void> {
        console.log(`-------- Packaging files (${arch}) --------`);
        const buildPath = path.join(this.repo.dir, "build");
        const tarPack = tarStream.pack();
        const tarBuffer = new WritableStreamBuffer;
        tarPack.pipe(tarBuffer);
        const prefix = `${this.platform}/${arch}`;
        const binaries = {"host": ["mirb", "mrbc", "mruby"], "host-debug": ["mrdb"]};
        for (let [dir, names] of Object.entries(binaries)) {
            for (let name of names) {
                const fullName = `${name}${this.suffix}`;
                const binPath = path.join(buildPath, dir, "bin", fullName);
                if (this.platform !== "win32") {
                    await spawnPromise(this.stripCommand, [binPath]);
                }
                console.log(`Adding ${fullName} ...`);
                const content = await readFile(binPath);
                tarPack.entry({name: `${prefix}/${fullName}`}, content);
            }
        }
        console.log("Adding version info ...");
        tarPack.entry({name: `${prefix}/version`}, EXT_VERSION);

        console.log("Adding internal ruby sources ...");
        const srcPack = tarStream.pack();
        const srcBuffer = new WritableStreamBuffer;
        srcPack.pipe(srcBuffer);
        for (let dir of ["lib", "mrbgems", "mrblib"]) {
            const files = await promisify(glob)(`${dir}/**/*.rb`, {cwd: this.repo.dir});
            for (let name of files) {
                srcPack.entry({name}, await readFile(
                    path.join(this.repo.dir, name)
                ));
            }
        }
        srcPack.finalize();
        tarPack.entry({name: `${prefix}/src.tar`}, srcBuffer.getContents() as Buffer);

        tarPack.finalize();
        const tarSize = tarBuffer.size();
        const lzmaPath = this.getLzmaPath(arch);
        const lzmaData = await new Promise<Buffer>((resolve) => {
            console.log(`Compressing to ${lzmaPath} ...`);
            LZMA().compress(tarBuffer.getContents() as Buffer, 9, resolve);
        });
        const lzmaSize = lzmaData.byteLength;
        console.log(`Compressed ${tarSize} -> ${lzmaSize} bytes`);
        await writeFile(lzmaPath, lzmaData);
        await writeFile(lzmaPath + ".version", EXT_VERSION);
    }

    async upload(arch: MRubyArch): Promise<void> {
        if (!this.uploader) {
            return;
        }
        console.log(`-------- Uploading archive (${arch}) --------`);
        const lzmaPath = this.getLzmaPath(arch);
        const verPath = lzmaPath + ".version";
        await this.uploader.upload([lzmaPath, verPath], this.mrubyVersion);
    }

    private getLzmaPath(arch: MRubyArch): string {
        return path.join(this.mrubyVersion, `${this.platform}-${arch}.tar.lzma`);
    }
}

void new Builder().run().catch((reason) => {
    console.error(reason);
    process.exit(1);
});
