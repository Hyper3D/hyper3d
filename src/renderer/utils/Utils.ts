
export interface IDisposable
{
    dispose(): void;
}

const imul: (a: number, b: number) => number  = (<any> Math).imul;

const deBruijnTable = [
    0, 1, 28, 2, 29, 14, 24, 3, 30, 22, 20, 15, 25, 17, 4, 8,
    31, 27, 13, 23, 21, 19, 16, 7, 26, 12, 18, 6, 11, 5, 10, 9
];

export const ulog2: (v: number) => number =
    imul ? (v: number) => {
        // have imul; use http://graphics.stanford.edu/~seander/bithacks.html#IntegerLogDeBruijn
        return deBruijnTable[imul(v, 0x077CB531) >>> 27];
    } : (v: number) => {
        let i = 0;
        while (v != 0) {
            ++i;
            v = (v >>> 1);
        }
        return i;
    };

export function isPowerOfTwo(num: number): boolean
{
    return (num & (num - 1)) == 0;
}

export function clamp(v: number, min: number, max: number): number
{
    return v < min ? min : v > max ? max : max;
}

export function getKeysOfObject(obj: any): string[]
{
    const ret: string[] = [];
    for (const key in obj) {
        ret.push(key);
    }
    return ret;
}

export function using<T extends IDisposable, U>(obj: T, fn: (obj: T) => U): U
{
    try {
        return fn(obj);
    } finally {
        obj.dispose();
    }
}

export function stringRepeat(str: string, count: number): string
{
   const parts: string[] = [];
   for (let i = 0; i < count; ++i) {
       parts.push(str);
   }
   return parts.join("");
}

export function fillWith(str: string, ln: number, ch: string): string
{
    return str + stringRepeat(ch, Math.max(0, ln - str.length));
}

export function fillWithRightAligned(str: string, ln: number, ch: string): string
{
    return stringRepeat(ch, Math.max(0, ln - str.length)) + str;
}