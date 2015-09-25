#pragma parameter globalSupportsSRGB

const float HdrMosaicLevel1 = 1. / 64.;
const float HdrMosaicLevel2 = 2.;
const float HdrMosaicMaximumLevel = 1. / HdrMosaicLevel1;

float hdrMosaicMode(highp vec2 fragCoord) {
	return step(fract(dot(floor(fragCoord.xy), vec2(0.5))), 0.25);
}

float hdrMosaicPatternForMode(float mode) {
	// FIXME: support non-sRGB mode
	return mix(HdrMosaicLevel1, HdrMosaicLevel2, mode);
}

float hdrMosaicInvPatternForMode(float mode) {
	// FIXME: support non-sRGB mode
	return mix(1. / HdrMosaicLevel1, 1. / HdrMosaicLevel2, mode);
}

float hdrMosaicPattern(highp vec2 fragCoord) {
	return hdrMosaicPatternForMode(hdrMosaicMode(fragCoord));
}

vec4 encodeHdrMosaicDithered(vec3 color, vec3 dither) {
	float lum = max(max(color.x, color.y), color.z);
	vec3 mosaiced = color.rgb * hdrMosaicPattern(gl_FragCoord.xy);
#if c_globalSupportsSRGB
	// buffer is sRGB; error is almost proportional to the value
	// (gamma is approximated to be 2.5)
	// stored + error = value^-2.5 (0 <= error <= 1/255)
	// dvalue/derror = d/derror((stored + error)^2.5)
	//               = 2.5(stored + error)^1.3
	//				 \approx 2.5(value^-2.5)^1.3
	//               < 2.5value
	// furthermore, be aware of linear part of sRGB conversion used when input is very dark
	mosaiced -= dither * ((2.5 / 255.) * mosaiced + 1. / 255. / 12.92);
#else
	// buffer is linear
	mosaiced -= dither * (1. / 255.);
#endif
	return vec4(mosaiced, lum * HdrMosaicLevel2);
}

vec4 encodeHdrMosaic(vec3 color) {
	return encodeHdrMosaicDithered(color, vec3(0.5));
}
