/// <reference path="../Prefix.d.ts" />


export class IntegerMap<T>
{
	private map: Map<number, T>;
	
	constructor()
	{
		this.map = new Map<number, T>();
	}
	
	get isEmpty(): boolean
	{
		return this.map.size == 0;
	}
	
	get(key: number, defaultValue?: T): T
	{
		const ret = this.map.get(key);
		if (typeof ret === 'undefined') {
			return defaultValue;
		}
		return ret;
	}
	
	set(key: number, value: T): T
	{
		this.map.set(key, value);
		return value;
	}	
	
	remove(key: number): boolean
	{
		return this.map.delete(key);
	}
	
	forEach(cb: (key: number, value: T) => void): void
	{
		this.map.forEach((value, key) => {
			cb(key, value);
		});
	}
}

