"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var fs_extra_1 = require("fs-extra");
var glob = require("glob");
var lzma_native_1 = require("lzma-native");
var path = require("path");
var semver_1 = require("semver");
var ssh2 = require("ssh2");
var stream_buffers_1 = require("stream-buffers");
var tarStream = require("tar-stream");
var util_1 = require("util");
var EXT_VERSION = require(path.join(__dirname, "package.json")).version;
function spawnPromise(command, args, options) {
    if (options === void 0) { options = {}; }
    var child = child_process_1.spawn(command, args, Object.assign({ stdio: "inherit" }, options));
    return new Promise(function (resolve, reject) {
        child.on("exit", function (code) {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error("Command (" + command + ") failed with code: " + code));
            }
        });
    });
}
var MRubyRepository = /** @class */ (function () {
    function MRubyRepository() {
        this.gitCommand = "git";
        this.gitUrl = "https://github.com/mruby/mruby.git";
    }
    MRubyRepository.prototype.clone = function (dir) {
        return __awaiter(this, void 0, void 0, function () {
            var fullPath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fullPath = path.resolve(dir);
                        if (!!fs_extra_1.existsSync(fullPath)) return [3 /*break*/, 2];
                        return [4 /*yield*/, spawnPromise(this.gitCommand, ["clone", this.gitUrl, fullPath])];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        this.clonedDir = fullPath;
                        return [2 /*return*/];
                }
            });
        });
    };
    MRubyRepository.prototype.spawnGit = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (!this.clonedDir) {
            throw new Error("Not cloned");
        }
        return spawnPromise(this.gitCommand, (_a = ["-C", this.clonedDir]).concat.apply(_a, args));
    };
    MRubyRepository.prototype.checkout = function (version) {
        return this.spawnGit("checkout", "--force", version);
    };
    MRubyRepository.prototype.clean = function () {
        return this.spawnGit("clean", "-d", "-f", "-q", "-x");
    };
    Object.defineProperty(MRubyRepository.prototype, "dir", {
        get: function () {
            if (!this.clonedDir) {
                throw new Error("Not cloned");
            }
            return this.clonedDir;
        },
        enumerable: true,
        configurable: true
    });
    return MRubyRepository;
}());
var Uploader = /** @class */ (function () {
    function Uploader() {
        this.host = process.env.SFTP_HOST;
        if (!this.host) {
            throw new Error("SFTP_HOST required");
        }
        this.port = parseInt(process.env.SFTP_PORT || "22");
        if (isNaN(this.port)) {
            throw new Error("SFTP_PORT required");
        }
        this.user = process.env.SFTP_USER;
        if (!this.user) {
            throw new Error("SFTP_USER required");
        }
        this.identity = process.env.SFTP_IDENTITY;
        if (!this.identity) {
            throw new Error("SFTP_IDENTITY required");
        }
        this.dest = process.env.SFTP_DEST;
        if (!this.dest) {
            throw new Error("SFTP_DEST required");
        }
    }
    Uploader.prototype.upload = function (files) {
        return __awaiter(this, void 0, void 0, function () {
            var client, connection, _a, _b, _c, sftp, fastPut, _i, files_1, file;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        client = new ssh2.Client();
                        connection = new Promise(function (resolve, reject) {
                            client.on("ready", resolve);
                            client.on("error", reject);
                        });
                        _b = (_a = client).connect;
                        _c = {
                            host: this.host,
                            port: this.port,
                            username: this.user
                        };
                        return [4 /*yield*/, fs_extra_1.readFile(this.identity)];
                    case 1:
                        _b.apply(_a, [(_c.privateKey = _d.sent(),
                                _c)]);
                        return [4 /*yield*/, connection];
                    case 2:
                        _d.sent();
                        sftp = util_1.promisify(client.sftp).call(client);
                        fastPut = util_1.promisify(sftp.fastPut).bind(sftp);
                        _i = 0, files_1 = files;
                        _d.label = 3;
                    case 3:
                        if (!(_i < files_1.length)) return [3 /*break*/, 6];
                        file = files_1[_i];
                        return [4 /*yield*/, fastPut(file, this.dest + "/" + path.basename(file))];
                    case 4:
                        _d.sent();
                        _d.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    return Uploader;
}());
var Builder = /** @class */ (function () {
    function Builder(workDir) {
        if (workDir === void 0) { workDir = "."; }
        this.suffix = "";
        this.rubyCommand = "ruby";
        this.stripCommand = "strip";
        this.workDir = path.resolve(workDir);
        this.mrubyVersion = process.env.MRUBY_VERSION;
        if (!this.mrubyVersion) {
            throw new Error("MRUBY_VERSION required");
        }
        this.platform = process.platform;
        switch (this.platform) {
            case "win32":
                this.archList = [process.env.MRUBY_ARCH];
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
                throw new Error("Unsupported platform: " + this.platform);
        }
        try {
            this.uploader = new Uploader();
        }
        catch (error) {
            console.error(error);
            console.warn("Warning: Uploading disabled");
        }
    }
    Builder.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, arch;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log("-------- Build information --------");
                        console.log("mruby Version: " + this.mrubyVersion);
                        console.log("Platform: " + this.platform);
                        console.log("Arch: " + this.archList.join(", "));
                        return [4 /*yield*/, this.checkout()];
                    case 1:
                        _b.sent();
                        _i = 0, _a = this.archList;
                        _b.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 8];
                        arch = _a[_i];
                        return [4 /*yield*/, this.isDone(arch)];
                    case 3:
                        if (_b.sent()) {
                            console.log("-------- Skip build (" + arch + ") --------");
                            return [3 /*break*/, 7];
                        }
                        return [4 /*yield*/, this.build(arch)];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, this.package(arch)];
                    case 5:
                        _b.sent();
                        return [4 /*yield*/, this.upload(arch)];
                    case 6:
                        _b.sent();
                        _b.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 2];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    Builder.prototype.checkout = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("-------- Checking out repository --------");
                        this.repo = new MRubyRepository();
                        return [4 /*yield*/, this.repo.clone(path.join(this.workDir, "mruby"))];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.repo.checkout(this.mrubyVersion)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.repo.clean()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Builder.prototype.isDone = function (arch) {
        return __awaiter(this, void 0, void 0, function () {
            var verPath, version, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        verPath = this.getLzmaPath(arch) + ".version";
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        _a = semver_1.SemVer.bind;
                        return [4 /*yield*/, fs_extra_1.readFile(verPath, "utf-8")];
                    case 2:
                        version = new (_a.apply(semver_1.SemVer, [void 0, (_c.sent()).trim()]))();
                        if (version.compare(EXT_VERSION) >= 0) {
                            return [2 /*return*/, true];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        _b = _c.sent();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, false];
                }
            });
        });
    };
    Builder.prototype.build = function (arch) {
        return __awaiter(this, void 0, void 0, function () {
            var env;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("-------- Building mruby (" + arch + ") --------");
                        env = Object.assign({}, process.env);
                        if ((this.platform !== "win32") && (arch === "ia32")) {
                            env.CFLAGS = "-m32";
                            env.LDFLAGS = "-m32";
                        }
                        return [4 /*yield*/, spawnPromise(this.rubyCommand, ["./minirake"], {
                                cwd: this.repo.dir,
                                env: env
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Builder.prototype.package = function (arch) {
        return __awaiter(this, void 0, void 0, function () {
            var buildPath, tarPack, tarBuffer, prefix, binaries, _i, _a, _b, dir, names, _c, names_1, name_1, fullName, binPath, content, srcPack, srcBuffer, _d, _e, dir, files, _f, files_2, name_2, _g, _h, _j, tarSize, lzmaPath, lzmaData, lzmaSize;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        console.log("-------- Packaging files (" + arch + ") --------");
                        buildPath = path.join(this.repo.dir, "build");
                        tarPack = tarStream.pack();
                        tarBuffer = new stream_buffers_1.WritableStreamBuffer;
                        tarPack.pipe(tarBuffer);
                        prefix = this.platform + "/" + arch;
                        binaries = { "host": ["mirb", "mrbc", "mruby"], "host-debug": ["mrdb"] };
                        _i = 0, _a = Object.entries(binaries);
                        _k.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 8];
                        _b = _a[_i], dir = _b[0], names = _b[1];
                        _c = 0, names_1 = names;
                        _k.label = 2;
                    case 2:
                        if (!(_c < names_1.length)) return [3 /*break*/, 7];
                        name_1 = names_1[_c];
                        fullName = "" + name_1 + this.suffix;
                        binPath = path.join(buildPath, dir, "bin", fullName);
                        if (!(this.platform !== "win32")) return [3 /*break*/, 4];
                        return [4 /*yield*/, spawnPromise(this.stripCommand, [binPath])];
                    case 3:
                        _k.sent();
                        _k.label = 4;
                    case 4:
                        console.log("Adding " + fullName + " ...");
                        return [4 /*yield*/, fs_extra_1.readFile(binPath)];
                    case 5:
                        content = _k.sent();
                        tarPack.entry({ name: prefix + "/" + fullName }, content);
                        _k.label = 6;
                    case 6:
                        _c++;
                        return [3 /*break*/, 2];
                    case 7:
                        _i++;
                        return [3 /*break*/, 1];
                    case 8:
                        console.log("Adding version info ...");
                        tarPack.entry({ name: prefix + "/version" }, EXT_VERSION);
                        console.log("Adding internal ruby sources ...");
                        srcPack = tarStream.pack();
                        srcBuffer = new stream_buffers_1.WritableStreamBuffer;
                        srcPack.pipe(srcBuffer);
                        _d = 0, _e = ["lib", "mrbgems", "mrblib"];
                        _k.label = 9;
                    case 9:
                        if (!(_d < _e.length)) return [3 /*break*/, 15];
                        dir = _e[_d];
                        return [4 /*yield*/, util_1.promisify(glob)(dir + "/**/*.rb", { cwd: this.repo.dir })];
                    case 10:
                        files = _k.sent();
                        _f = 0, files_2 = files;
                        _k.label = 11;
                    case 11:
                        if (!(_f < files_2.length)) return [3 /*break*/, 14];
                        name_2 = files_2[_f];
                        _h = (_g = srcPack).entry;
                        _j = [{ name: name_2 }];
                        return [4 /*yield*/, fs_extra_1.readFile(path.join(this.repo.dir, name_2))];
                    case 12:
                        _h.apply(_g, _j.concat([_k.sent()]));
                        _k.label = 13;
                    case 13:
                        _f++;
                        return [3 /*break*/, 11];
                    case 14:
                        _d++;
                        return [3 /*break*/, 9];
                    case 15:
                        srcPack.finalize();
                        tarPack.entry({ name: prefix + "/src.tar" }, srcBuffer.getContents());
                        tarPack.finalize();
                        tarSize = tarBuffer.size();
                        lzmaPath = this.getLzmaPath(arch);
                        return [4 /*yield*/, new Promise(function (resolve) {
                                console.log("Compressing to " + lzmaPath + " ...");
                                lzma_native_1.LZMA().compress(tarBuffer.getContents(), 9, resolve);
                            })];
                    case 16:
                        lzmaData = _k.sent();
                        lzmaSize = lzmaData.byteLength;
                        console.log("Compressed " + tarSize + " -> " + lzmaSize + " bytes");
                        return [4 /*yield*/, fs_extra_1.writeFile(lzmaPath, lzmaData)];
                    case 17:
                        _k.sent();
                        return [4 /*yield*/, fs_extra_1.writeFile(lzmaPath + ".version", EXT_VERSION)];
                    case 18:
                        _k.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Builder.prototype.upload = function (arch) {
        return __awaiter(this, void 0, void 0, function () {
            var lzmaPath, verPath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.uploader) {
                            return [2 /*return*/];
                        }
                        console.log("-------- Uploading archive (" + arch + ") --------");
                        lzmaPath = this.getLzmaPath(arch);
                        verPath = lzmaPath + ".version";
                        return [4 /*yield*/, this.uploader.upload([lzmaPath, verPath])];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Builder.prototype.getLzmaPath = function (arch) {
        return path.join(this.mrubyVersion, this.platform + "-" + arch + ".tar.lzma");
    };
    return Builder;
}());
void new Builder().run().catch(function (reason) {
    console.error(reason);
    process.exit(1);
});
