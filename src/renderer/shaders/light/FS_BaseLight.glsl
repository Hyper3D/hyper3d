// this shader is abstract; must be imported and main function must be provided

#pragma require HdrMosaic

uniform sampler2D u_dither;
varying highp vec2 v_ditherCoord;

void emitLightPassOutput(vec3 lit)
{
	float lum = max(max(lit.x, lit.y), lit.z);

	// overflow protection
	const float lumLimit = HdrMosaicMaximumLevel * 0.7;
	if (lum > lumLimit) {
		lit *= lumLimit / lum;
	}

	// dither
	vec3 dither = texture2D(u_dither, v_ditherCoord).xyz;

	vec4 mosaicked = encodeHdrMosaicDithered(lit, dither);
	gl_FragColor = mosaicked;
}
