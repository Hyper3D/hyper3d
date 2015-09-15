float hdrMosaicPattern(vec2 fragCoord) {
	float pos = dot(floor(fragCoord.xy), vec2(0.5));
	return mix(1. / 16., 4., fract(pos));
}

vec4 encodeHdrMosaic(vec4 color) {
	vec3 mosaiced = color.rgb * hdrMosaicPattern(gl_FragCoord);
	return vec4(mosaiced, max(max(mosaiced.x, mosaiced.y), mosaiced.z));
}

