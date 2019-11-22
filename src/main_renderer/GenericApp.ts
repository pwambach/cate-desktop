interface GenericApp {

    getName(): string;

    getVersion(): string;

    getAppPath(): string;

    getPath(name: string): string;
}
