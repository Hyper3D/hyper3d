// this shader is abstract; must be imported and main function must be provided

#pragma require HdrMosaic

void emitLightPassOutput(vec3 lit)
{
	float lum = max(max(lit.x, lit.y), lit.z);

	// overflow protection
	const float lumLimit = HdrMosaicMaximumLevel * 0.7;
	if (lum > lumLimit) {
		lit *= lumLimit / lum;
	}

	vec4 mosaicked = encodeHdrMosaic(lit);
	gl_FragColor = mosaicked;
}
