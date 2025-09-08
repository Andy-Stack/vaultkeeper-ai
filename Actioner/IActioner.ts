export interface IActioner {
    [key: symbol]: (...args: any[]) => any;
}