#pragma require FS_VolumetricsFomVisibilityGeometry
#extension GL_EXT_draw_buffers : require

void main()
{
	FomCoefs coefs = evaluateFomCoefs();
	gl_FragData[0] = vec4(coefs.c0, 0., coefs.c1);
	gl_FragData[1] = vec4(coefs.c2, coefs.c3);
	gl_FragData[2] = vec4(coefs.c4, coefs.c5);
	gl_FragData[3] = vec4(coefs.c6, coefs.c7);
}
