
import * as three from "three";

export interface ObjectPool<T>
{
    alloc(): T;
    free(obj: T): void;
}

class ObjectPoolImpl<T>
{
    private pool: T[];

    constructor(private factory: () => T)
    {
        this.pool = [];
    }
    alloc(): T
    {
        const obj = this.pool.pop();
        return obj ? obj : this.factory();
    }
    free(obj: T): void
    {
        this.pool.push(obj);
    }
}

export const Vector2Pool: ObjectPool<three.Vector2> =
    new ObjectPoolImpl<three.Vector2>(() => new three.Vector2());
export const Vector3Pool: ObjectPool<three.Vector3> =
    new ObjectPoolImpl<three.Vector3>(() => new three.Vector3());
export const Vector4Pool: ObjectPool<three.Vector4> =
    new ObjectPoolImpl<three.Vector4>(() => new three.Vector4());
export const Matrix4Pool: ObjectPool<three.Matrix4> =
    new ObjectPoolImpl<three.Matrix4>(() => new three.Matrix4());
