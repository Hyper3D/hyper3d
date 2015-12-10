/// <reference path="../Prefix.d.ts" />

import * as three from 'three';

export interface ViewVectors
{
	offset: three.Vector2;
	coefX: three.Vector2;
	coefY: three.Vector2;
}

export const tmpM = new three.Matrix4();
export const tmpM2 = new three.Matrix4();
export const tmpM3 = new three.Matrix4();
export const tmpVec = new three.Vector4();
export const tmpVec2 = new three.Vector4();
export const tmpV3a = new three.Vector3();
export const tmpV3b = new three.Vector3();
export const tmpV3c = new three.Vector3();
export const tmpV3d = new three.Vector3();

export function computeViewVectorCoefFromProjectionMatrix(m: three.Matrix4, old?: ViewVectors): ViewVectors
{
	if (!old) {
		old = <ViewVectors>{
			offset: new three.Vector2(),
			coefX: new three.Vector2(),
			coefY: new three.Vector2()
		};
	}
	
	tmpVec.set(0, 0, 1, 1);
	tmpVec.applyMatrix4(m);
	
	tmpM.getInverse(m);
	
	tmpVec2.set(0, 0, tmpVec.z, tmpVec.w);
	tmpVec2.applyMatrix4(tmpM);
	old.offset.set(tmpVec2.x, tmpVec2.y);
	
	tmpVec2.set(-1, 0, tmpVec.z, tmpVec.w);
	tmpVec2.applyMatrix4(tmpM);
	old.coefX.set(tmpVec2.x, tmpVec2.y);
	
	tmpVec2.set(0, -1, tmpVec.z, tmpVec.w);
	tmpVec2.applyMatrix4(tmpM);
	old.coefY.set(tmpVec2.x, tmpVec2.y);
	
	return old;
}

export function computeFarDepthFromProjectionMatrix(m: three.Matrix4): number
{
	return (m.elements[15] - m.elements[14]) / (m.elements[11] - m.elements[10]);
}
