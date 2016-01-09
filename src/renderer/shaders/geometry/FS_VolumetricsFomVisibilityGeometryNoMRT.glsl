#pragma require FS_VolumetricsFomVisibilityGeometry

uniform lowp int u_renderTargetId;

void main()
{
	FomCoefs coefs = evaluateFomCoefs();
	if (u_renderTargetId >= 2) {
		if (u_renderTargetId == 3) {
			gl_FragColor = vec4(coefs.c6, coefs.c7);
		} else {
			gl_FragColor = vec4(coefs.c4, coefs.c5);
		}
	} else if (u_renderTargetId == 1) {
		gl_FragColor = vec4(coefs.c2, coefs.c3);
	} else {
		gl_FragColor = vec4(coefs.c0, 0., coefs.c1);
	}
}

