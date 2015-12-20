/// <reference path="../Prefix.d.ts" />

export class Map<TKey, TValue>
{
    private table: MapNode<TKey, TValue>[];
    private first: MapNode<TKey, TValue>;

    constructor()
    {
        this.table = [];
        this.first = null;
    }

    computeHash(key: TKey): number
    {
        throw new Error("not implemented");
    }

    equals(key1: TKey, key2: TKey): boolean
    {
        throw new Error("not implemented");
    }

    get isEmpty(): boolean
    {
        return this.first == null;
    }

    get(key: TKey, defaultValue?: TValue): TValue
    {
        const hash = this.computeHash(key);
        const node = this.table[hash];
        if (node) {
            let item = node.head;
            while (item != null) {
                if (this.equals(key, item.key)) {
                    return item.value;
                }
                item = item.next;
            }
        }
        return defaultValue;
    }

    set(key: TKey, value: TValue): TValue
    {
        const hash = this.computeHash(key);
        let node = this.table[hash];
        if (node) {
            let item = node.head;
            while (item != null) {
                if (this.equals(key, item.key)) {
                    return item.value = value;
                }
                item = item.next;
            }
        }

        const item = {
            key: key,
            value: value,
            next: node ? node.head : null
        };

        if (node) {
            node.head = item;
        } else {
            node = {
                head: item,
                prev: null,
                next: null
            };
            if (this.first) {
                node.next = this.first;
                node.prev = this.first.prev;
                node.next.prev = node;
                node.prev.next = node;
            } else {
                this.first = node.prev = node.next = node;
            }
            this.table[hash] = node;
        }

        return value;
    }

    remove(key: TKey): boolean
    {
        const hash = this.computeHash(key);
        let node = this.table[hash];
        if (node) {
            let prevItem: MapItem<TKey, TValue> = null;
            let item = node.head;
            while (item != null) {
                if (this.equals(key, item.key)) {
                    if (prevItem) {
                        prevItem.next = item.next;
                    } else if (item.next == null) {
                        delete this.table[hash];
                        if (this.first == node) {
                            if (node.next == node) {
                                this.first = null;
                            } else {
                                this.first = node.next;
                            }
                        }
                        if (node.next != node) {
                            node.next.prev = node.prev;
                            node.prev.next = node.next;
                        }
                    } else {
                        node.head = item.next;
                    }
                    return true;
                }
                prevItem = item;
                item = item.next;
            }
        }
        return false;
    }

    forEach(cb: (key: TKey, value: TValue) => void): void
    {
        if (this.first) {
            let node = this.first;
            do {
                const next = node.next;
                let item = node.head;
                do {
                    const nextItem = item.next;
                    cb(item.key, item.value);
                    item = nextItem;
                } while (item);
                node = next;
            } while (node != this.first);
        }
    }
}

interface MapNode<TKey, TValue>
{
    head: MapItem<TKey, TValue>;
    prev: MapNode<TKey, TValue>;
    next: MapNode<TKey, TValue>;
}

interface MapItem<TKey, TValue>
{
    key: TKey;
    value: TValue;
    next: MapItem<TKey, TValue>;
}
