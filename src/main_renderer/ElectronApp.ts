import * as electron from 'electron';



export class ElectronApp implements GenericApp {
    getAppPath(): string {
        return electron.app.getAppPath();
    }

    getName(): string {
        return electron.app.getName();
    }

    getPath(name: string): string {
        return electron.app.getPath(name);
    }

    getVersion(): string {
        return electron.app.getVersion();
    }
}

