const float HdrMosaicLevel1 = 1. / 8.;
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

vec4 encodeHdrMosaic(vec3 color) {
	float lum = max(max(color.x, color.y), color.z);
	vec3 mosaiced = color.rgb * hdrMosaicPattern(gl_FragCoord.xy);
	return vec4(mosaiced, lum * HdrMosaicLevel2);
}

