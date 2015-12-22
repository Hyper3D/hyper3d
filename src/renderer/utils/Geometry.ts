/// <reference path="../Prefix.d.ts" />

import * as three from "three";
import {
    Vector3Pool,
    Vector4Pool,
    Matrix4Pool
} from "./ObjectPool";

export interface ViewVectors
{
    offset: three.Vector2;
    coefX: three.Vector2;
    coefY: three.Vector2;
}

export function computeViewVectorCoefFromProjectionMatrix(m: three.Matrix4, old?: ViewVectors): ViewVectors
{
    if (!old) {
        old = <ViewVectors> {
            offset: new three.Vector2(),
            coefX: new three.Vector2(),
            coefY: new three.Vector2()
        };
    }

    const t1 = Vector4Pool.alloc();
    const t2 = Vector4Pool.alloc();
    const tm = Matrix4Pool.alloc();

    t1.set(0, 0, 1, 1);
    t1.applyMatrix4(m);

    tm.getInverse(m);

    t2.set(0, 0, t1.z, t1.w);
    t2.applyMatrix4(tm);
    old.offset.set(t2.x, t2.y);

    t2.set(-1, 0, t1.z, t1.w);
    t2.applyMatrix4(tm);
    old.coefX.set(t2.x, t2.y);

    t2.set(0, -1, t1.z, t1.w);
    t2.applyMatrix4(tm);
    old.coefY.set(t2.x, t2.y);

    Vector4Pool.free(t1);
    Vector4Pool.free(t2);
    Matrix4Pool.free(tm);

    return old;
}

export function computeFarDepthFromProjectionMatrix(m: three.Matrix4): number
{
    return (m.elements[15] - m.elements[14]) / (m.elements[11] - m.elements[10]);
}

export class ObjectBoundingBoxCalculator
{
    computeBoundingBox(obj: three.Object3D, old?: three.Box3): three.Box3
    {
        if (old == null) {
            old = new three.Box3();
        }

        old.makeEmpty();

        this.traverse(obj, old);

        return old;
    }

    traverse(obj: three.Object3D, box: three.Box3): void
    {
        for (const child of obj.children) {
            this.traverse(child, box);
        }
        this.addObject(obj, box);
    }

    addObject(obj: three.Object3D, box: three.Box3): void
    {
        if (obj instanceof three.Mesh) {
            const geometry = obj.geometry;
            if (geometry == null) {
                return;
            }

            // use sphere for more conservative check
            if (geometry.boundingSphere == null) {
                geometry.computeBoundingSphere();
            }

            const v = Vector3Pool.alloc();
            const rad = geometry.boundingSphere.radius;
            v.set(rad, rad, rad);
            v.applyMatrix4(obj.matrixWorld);

            const center = Vector3Pool.alloc();
            obj.getWorldPosition(center);

            const actualRad = center.distanceTo(v);
            v.copy(center);
            center.addScalar(actualRad);
            v.subScalar(actualRad);

            box.expandByPoint(v);
            box.expandByPoint(center);

            Vector3Pool.free(v);
            Vector3Pool.free(center);
        }
    }
}

export class ShadowCastingObjectBoundingBoxCalculator extends ObjectBoundingBoxCalculator
{
    traverse(obj: three.Object3D, box: three.Box3): void
    {
        if (!obj.visible) {
            return;
        }
        return ObjectBoundingBoxCalculator.prototype.traverse.call(this, obj, box);
    }
    addObject(obj: three.Object3D, box: three.Box3): void
    {
        if (!obj.castShadow) {
            return;
        }
        return ObjectBoundingBoxCalculator.prototype.addObject.call(this, obj, box);
    }
}
