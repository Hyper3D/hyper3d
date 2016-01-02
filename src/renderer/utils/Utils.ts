
export interface IDisposable
{
    dispose(): void;
}

const imul: (a: number, b: number) => number  = (<any> Math).imul;

const deBruijnTable = [
    0,  9,  1, 10, 13, 21,  2, 29, 11, 14, 16, 18, 22, 25,  3, 30,
    8, 12, 20, 28, 15, 17, 24,  7, 19, 27, 23,  6, 26,  5,  4, 31
];

export const ulog2: (v: number) => number =
    imul ? (v: number) => {
        // have imul; use http://graphics.stanford.edu/~seander/bithacks.html#IntegerLogDeBruijn
        v |= v >> 1;
        v |= v >> 2;
        v |= v >> 4;
        v |= v >> 8;
        v |= v >> 16;
        return deBruijnTable[imul(v, 0x077cb531) >>> 27];
    } : (v: number) => {
        let i = 0;
        while (v != 0) {
            ++i;
            v = (v >>> 1);
        }
        return i;
    };

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