
export interface IDisposable
{
	dispose(): void;
}

const imul: (a: number, b: number) => number  = (<any>Math).imul;

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

