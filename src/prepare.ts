/*
 * Do not use "vscode" module in this file!
 */
import * as download from "download";
import * as tar from "tar";
import * as path from "path";
import * as fs from "fs-extra";
import { PassThrough } from "stream";
import { MrubyVersion } from "./versions";
const lzma = require("lzma");
import * as nls from "vscode-nls";
const localize = nls.loadMessageBundle();

const RAW_URL_BASE = "https://github.com/kimushu/vscode-mruby/raw/binary";
const KEEP_DOWNLOADED_ARCHIVE = true;

type PrepareProgress = (title: string, task: () => Promise<void>) => Promise<void>;

/**
 * Prepare platform dependent binary
 * @param version Version of mruby
 * @param name Name of binary ("mruby", "mrbc", etc.) without extensions
 * @returns The full path of the binary
 */
export async function prepareBinary<T>(version: MrubyVersion, name: string, progress: PrepareProgress): Promise<string> {
    const baseDir = path.join(__dirname, "..", "lib", version);
    let fullPath = path.join(baseDir, process.platform, process.arch, name);
    if (process.platform === "win32") {
        fullPath += ".exe";
    }

    if (!fs.existsSync(fullPath)) {
        // Binary does not exist
        let archivePath = path.join(baseDir, `${process.platform}-${process.arch}.tar.lzma`);
        let archiveData: Buffer;
        if (fs.existsSync(archivePath)) {
            archiveData = await fs.readFile(archivePath);
        } else {
            // Archive does not exist
            await progress(localize("downloading-mruby-x", "Downloading mruby {0}...", version), async () => {
                archiveData = await download(`${RAW_URL_BASE}/${version}/${path.basename(archivePath)}`);
                if (KEEP_DOWNLOADED_ARCHIVE) {
                    await fs.ensureDir(path.dirname(archivePath));
                    await fs.writeFile(archivePath, archiveData);
                }
            });
        }

        // Unpack archive
        await progress(localize("unpacking-mruby-x", "Unpacking mruby {0}...", version), async () => {
            const stream = new PassThrough;
            stream.end(await new Promise<Buffer>((resolve, reject) => {
                lzma.decompress(archiveData, (result: number[], error?: Error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(Buffer.from(result));
                    }
                });
            }));

            let maxWarnings = 5;
            await new Promise((resolve, reject) => {
                stream.pipe(tar.extract({
                    cwd: baseDir,
                    onwarn: (message, data) => {
                        if (maxWarnings > 0) {
                            console.warn("tar:", message, data);
                        } else if (maxWarnings === 0) {
                            console.warn("tar: too many warnings!");
                        }
                        --maxWarnings;
                    }
                }))
                .on("finish", resolve)
                .on("error", reject);
            });
        });

        if (!fs.existsSync(fullPath)) {
            throw Error("Cannot unpack archive");
        }
    }

    return fullPath;
}
