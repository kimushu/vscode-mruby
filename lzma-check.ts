import { execFile } from "child_process";
import { readFile, createWriteStream, unlinkSync } from "fs-extra";
import * as glob from "glob";
import * as lzma from "lzma";
import { tmpdir } from "os";
import * as path from "path";
import { ReadableStreamBuffer } from "stream-buffers";
import * as tar from "tar-stream";
import { promisify } from "util";

async function main() {
    if (process.platform !== "linux") {
        throw new Error("Must be run on Linux");
    }
    const files = await promisify(glob)(path.join(__dirname, "**", "*.lzma"));
    const tempName = path.join(tmpdir(), `${Math.random().toString(36).substr(2)}.tmp`);
    let failures = 0;
    for (let file of files) {
        const lzmaContent = await readFile(file);
        console.log(`Testing ${file} ...`);
        const success = await new Promise((resolve) => {
            lzma.decompress(lzmaContent, (result: any, error?: Error) => {
                if (error) {
                    console.log(" => Decompress failed:", error);
                    return resolve(false);
                }
                let input = new ReadableStreamBuffer({chunkSize: 1024*1024});
                input.put(Buffer.from(result));
                input.stop();
                let extract = tar.extract();
                extract.on("entry", (headers, stream, next) => {
                    const temp = createWriteStream(tempName);
                    stream.pipe(temp);
                    stream.on("end", () => {
                        temp.close();
                    });
                    temp.on("close", () => {
                        execFile("file", ["-b", tempName], (_, stdout) => {
                            console.log(` => ${headers.name}: ${stdout.trim()}`);
                            unlinkSync(tempName);
                            next();
                        });
                    });
                    stream.resume();
                });
                extract.on("finish", () => {
                    resolve(true);
                });
                extract.on("error", (error) => {
                    console.log(" => tar extract failed:", error);
                    resolve(false);
                });
                input.pipe(extract);
            });
        });
        if (success) {
            console.log(" => Success");
        } else {
            ++failures;
        }
    }
    process.exitCode = (failures > 0) ? 1 : 0;
}

void main().catch((reason) => {
    console.error(reason);
    process.exitCode = 1;
});
