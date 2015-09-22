// this shader is abstract; must be imported and main function must be provided

#pragma require HdrMosaic

void emitLightPassOutput(vec3 lit)
{
	vec4 mosaicked = encodeHdrMosaic(lit);
	gl_FragColor = mosaicked;
}
