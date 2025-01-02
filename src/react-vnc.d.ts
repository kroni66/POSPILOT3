declare module '@novnc/novnc' {
    export default class RFB {
        constructor(
            target: HTMLCanvasElement,
            url: string,
            options?: {
                credentials?: { password: string };
                [key: string]: any;
            }
        );

        addEventListener(event: string, callback: (...args: any[]) => void): void;
        removeEventListener(event: string, callback: (...args: any[]) => void): void;
        disconnect(): void;
        sendCredentials(credentials: { password: string }): void;
    }
}