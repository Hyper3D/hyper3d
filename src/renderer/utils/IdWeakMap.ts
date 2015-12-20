/// <reference path="../Prefix.d.ts" />

import * as three from "three";

import { IntegerMap } from "./IntegerMap";
import { IDisposable } from "./Utils";

export class IdWeakMap<K extends EventDispatcherWithId, T>
{
    private map: IntegerMap<IdWeakMapItem<K, T>>;

    constructor()
    {
        this.map = new IntegerMap<IdWeakMapItem<K, T>>();
    }

    get isEmpty(): boolean
    {
        return this.map.isEmpty;
    }

    disposeValue(value: T): void
    {
    }

    get(key: K): T
    {
        const item = this.map.get(key.id);
        if (item) {
            if (item.key != key) {
                throw new Error();
            }
            return item.value;
        } else {
            return null;
        }
    }

    set(key: K, value: T): T
    {
        const item = this.map.get(key.id);
        if (item) {
            if (item.key != key) {
                throw new Error();
            }
            item.value = value;
        } else {
            const id = key.id;
            const handler = () => this.onItemDisposed(id);
            key.addEventListener("disposed", handler);
            this.map.set(key.id, {
                key, value,
                handler: handler
            });
        }

        return value;
    }

    remove(key: K): boolean
    {
        const item = this.map.get(key.id);
        if (item == null) {
            return false;
        }
        if (item.key != key) {
            throw new Error();
        }
        this.map.remove(key.id);
        item.key.removeEventListener("disposed", item.handler);
        this.disposeValue(item.value);
        return true;
    }

    dispose(): void
    {
        this.map.forEach((id, item) => {
            item.key.removeEventListener("disposed", item.handler);
            this.disposeValue(item.value);
            this.map.remove(id);
        });
    }

    onItemDisposed(id: number): void
    {
        const item = this.map.get(id);
        this.map.remove(id);
        item.key.removeEventListener("disposed", item.handler);
        this.disposeValue(item.value);
    }
}

interface IdWeakMapItem<K extends EventDispatcherWithId, T>
{
    key: K;
    value: T;
    handler: () => void;
}

export interface EventDispatcherWithId extends three.EventDispatcher
{
    id: number;
}

export class IdWeakMapWithDisposable<K extends EventDispatcherWithId, T extends IDisposable> extends IdWeakMap<K, T>
{
    disposeValue(value: T): void
    {
        value.dispose();
    }
}
