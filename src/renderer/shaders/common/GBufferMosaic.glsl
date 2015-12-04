
vec2 gBufferMosaicPatternNonNormalized(highp vec2 fragCoord) {
	highp vec2 pos = floor(fragCoord.xy);
	return fract(pos * 0.5);
}

vec2 gBufferMosaicPattern(highp vec2 fragCoord) {
	return gBufferMosaicPatternNonNormalized(fragCoord) * 2.;
}

vec4 encodeGBufferMosaic(vec4 g0, vec4 g1, vec4 g2, vec4 g3) {
	g0.xyz *= g0.xyz;
	g3.xyz *= g3.xyz;
	
#if 1
	// using branch
	vec2 pattern = gBufferMosaicPatternNonNormalized(gl_FragCoord.xy);
	
	g0 = pattern.x > .25 ? g1 : g0;
	g2 = pattern.x > .25 ? g3 : g2;
	
	return pattern.y > .25 ? g2 : g0;
#else
	// branch-less
	vec2 pattern = gBufferMosaicPattern(gl_FragCoord.xy);
	
	g0 = mix(g0, g1, pattern.x);
	g2 = mix(g2, g3, pattern.x);
	
	return mix(g0, g2, pattern.y);
#endif
}
