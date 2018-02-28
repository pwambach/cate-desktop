import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {URL} from "url";
import {existsFile, execFile, deleteFile, downloadFile, FileExecOutput} from './fileutil';


import {
    Transaction,
    TransactionContext,
    TransactionProgressHandler, TransactionState
} from '../common/transaction';


function _getOutput(output: FileExecOutput) {
    // Note "python --version" outputs to stderr!
    return ((output.stdout && output.stdout !== '') ? output.stdout : output.stderr) || '';
}


export class DownloadMiniconda extends Transaction {

    constructor() {
        super('DownloadMiniconda', [], 'Download Miniconda');
    }

    getMinicondaInstallerUrl(): string {
        const platform = process.platform;
        if (platform === "win32") {
            return "https://repo.continuum.io/miniconda/Miniconda3-latest-Windows-x86_64.exe";
        } else if (platform === "darwin") {
            return "https://repo.continuum.io/miniconda/Miniconda3-latest-MacOSX-x86_64.sh";
        } else if (platform === "linux") {
            return "https://repo.continuum.io/miniconda/Miniconda3-latest-Linux-x86_64.sh";
        }
        throw new Error(`${this.name}: platform "${platform}" is not supported`);
    }

    getMinicondaInstallerExecutable(context: TransactionContext): string {
        const state = this.getState(context);
        let minicondaInstallerExecutable = state.minicondaInstallerExecutable;
        if (!minicondaInstallerExecutable) {
            const sourceUrl = new URL(this.getMinicondaInstallerUrl());
            const pos = sourceUrl.pathname.lastIndexOf('/');
            const fileName = pos >= 0 ? sourceUrl.pathname.slice(pos + 1) : sourceUrl.pathname;
            const tmpDir = os.tmpdir();
            minicondaInstallerExecutable = path.join(fs.mkdtempSync(`${tmpDir}${path.sep}cate-`), fileName);
            state.minicondaInstallerExecutable = minicondaInstallerExecutable;
        }
        return minicondaInstallerExecutable;
    }

    newInitialState(context: TransactionContext): TransactionState {
        return {
            minicondaInstallerUrl: this.getMinicondaInstallerUrl(),
            minicondaInstallerExecutable: null,
        };
    }

    fulfilled(context: TransactionContext, onProgress: TransactionProgressHandler): Promise<boolean> {
        return existsFile(this.getMinicondaInstallerExecutable(context));
    }

    fulfill(context: TransactionContext, onProgress: TransactionProgressHandler): Promise<any> {
        const targetFile = this.getMinicondaInstallerExecutable(context);
        let progressHandler = (bytesReceived: number, bytesTotal: number) => {
            const subWorked = bytesReceived / bytesTotal;
            const percent = Math.round(100 * subWorked);
            const message = `Downloading ${targetFile}: ${bytesReceived} of ${bytesTotal} bytes received, ${percent}%`;
            onProgress({message, subWorked});
        };
        return downloadFile(this.getMinicondaInstallerUrl(), targetFile, progressHandler);
    }

    rollback(context: TransactionContext, onProgress: TransactionProgressHandler): Promise<any> {
        return deleteFile(this.getMinicondaInstallerExecutable(context), true);
    }
}


export class InstallMiniconda extends Transaction {
    minicondaInstallDir: string;

    constructor(minicondaInstallDir: string) {
        super('InstallMiniconda', ['DownloadMiniconda'], 'Install Miniconda');
        this.minicondaInstallDir = minicondaInstallDir;
    }

    getMinicondaInstallerArgs() {
        if (process.platform === "win32") {
            return ['/S', '/InstallationType=JustMe', '/AddToPath=0', '/RegisterPython=0', `/D=${this.minicondaInstallDir}`];
        } else {
            return ['-b', '-f', '-p', this.minicondaInstallDir];
        }
    }

    getPythonExecutable() {
        return getCondaPythonExecutable(this.minicondaInstallDir);
    }

    newInitialState(context: TransactionContext): TransactionState {
        return {
            minicondaInstallDir: this.minicondaInstallDir,
            minicondaInstallerArgs: this.getMinicondaInstallerArgs(),
            pythonExecutable: this.getPythonExecutable(),
        };
    }

    fulfilled(context: TransactionContext, onProgress: TransactionProgressHandler): Promise<boolean> {
        const pythonExecutable = this.getPythonExecutable();
        return execFile(pythonExecutable, ['--version']).then((output: FileExecOutput) => {
            const line = _getOutput(output);
            return line.startsWith("Python 3.");
        }).catch(() => {
            return false;
        });
    }

    fulfill(context: TransactionContext, onProgress: TransactionProgressHandler): Promise<any> {
        const minicondaInstallerExecutable = context.getTransactionState('DownloadMiniconda').minicondaInstallerExecutable;
        this.getState(context).minicondaInstalled = true;
        return execFile(minicondaInstallerExecutable, this.getMinicondaInstallerArgs(), onProgress);
    }

    rollback(context: TransactionContext, onProgress: TransactionProgressHandler): Promise<any> {
        if (this.getState(context).minicondaInstalled) {
            // const minicondaInstallDir = this.minicondaInstallDir;
            // deleteInstallDir
        }
        return Promise.resolve();
    }
}

export class InstallCondaEnv extends Transaction {
    condaDir: string;

    constructor(condaDir: string) {
        super('InstallOrUpdateCate', [], 'Installing Conda environment');
        this.condaDir = condaDir;
    }

    getCondaDir() {
        return this.condaDir;
    }

    getCondaExecutable() {
        return getCondaExecutable(this.getCondaDir());
    }

    getCondaEnvDir() {
        return path.join(this.getCondaDir(), "envs", "cate-env");
    }

    getEnvPythonExecutable() {
        return getCondaPythonExecutable(this.getCondaEnvDir());
    }

    newInitialState(context: TransactionContext): TransactionState {
        return {
            condaDir: this.condaDir,
        };
    }

    fulfilled(context: TransactionContext, onProgress: TransactionProgressHandler): Promise<boolean> {
        const pythonExecutable = this.getEnvPythonExecutable();
        return execFile(pythonExecutable, ['--version']).then((output: FileExecOutput) => {
            const line = _getOutput(output);
            return line.startsWith("Python 3.");
        }).catch(() => {
            return false;
        });
    }

    fulfill(context: TransactionContext, onProgress: TransactionProgressHandler): Promise<any> {
        const condaExecutable = this.getCondaExecutable();
        return execFile(condaExecutable, ['conda', 'env', 'create', '-n', 'cate-env', 'python=3'], onProgress);
    }
}

export class InstallOrUpdateCate extends Transaction {
    cateVersion: string;
    cateDir: string;

    constructor(cateVersion: string, cateDir: string, requires: string[]) {
        super('InstallOrUpdateCate', requires, 'Install or update to cate-' + cateVersion);
        this.cateVersion = cateVersion;
        this.cateDir = cateDir;
    }

    // noinspection JSMethodCanBeStatic
    getCateDir() {
        return this.cateDir;
    }

    getCateCliExecutable() {
        return getCateCliExecutable(this.getCateDir());
    }

    getCondaExecutable() {
        return getCondaExecutable(this.getCateDir());
    }

    newInitialState(context: TransactionContext): TransactionState {
        return {
            cateVersion: this.cateVersion,
            cateDir: this.getCateDir(),
        };
    }

    fulfilled(context: TransactionContext, onProgress: TransactionProgressHandler): Promise<boolean> {
        const cateCliExecutable = this.getCateCliExecutable();
        return execFile(cateCliExecutable, ['cate', '--version']).then((output: FileExecOutput) => {
            const line = _getOutput(output);
            return line.startsWith(this.cateVersion);
        }).catch(() => {
            return false;
        });
    }

    fulfill(context: TransactionContext, onProgress: TransactionProgressHandler): Promise<any> {
        const condaExecutable = this.getCondaExecutable();
        return execFile(condaExecutable, ['install', '--yes', '-c', 'ccitools', '-c', 'conda-forge', 'cate-cli=' + this.cateVersion], onProgress);
    }
}

function getCondaPythonExecutable(condaDir: string) {
    if (process.platform === "win32") {
        return path.join(condaDir, 'python.exe');
    } else {
        return path.join(condaDir, 'bin', 'python');
    }
}

function getCondaExecutable(condaDir: string) {
    if (process.platform === "win32") {
        return path.join(condaDir, 'Scripts', 'conda.exe');
    } else {
        return path.join(condaDir, 'bin', 'conda');
    }
}

function getCateCliExecutable(condaDir: string) {
    if (process.platform === "win32") {
        return path.join(condaDir, 'Scripts', 'cate-cli.bat');
    } else {
        return path.join(condaDir, 'bin', 'cate-cli.sh');
    }
}
