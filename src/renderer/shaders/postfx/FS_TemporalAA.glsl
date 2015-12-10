#pragma require Globals
#pragma require GBuffer
#pragma require DepthFetch
#pragma require YUV
#pragma parameter useWiderFilter

uniform sampler2D u_input;
uniform sampler2D u_linearDepth;
uniform sampler2D u_g0;
uniform sampler2D u_g1;
uniform sampler2D u_oldAccum;
uniform sampler2D u_oldDepth;

varying highp vec2 v_texCoord;

float calculateLuminance(vec3 color)
{
	return color.x + color.y;
}

void main()
{
	
	vec4 g0 = texture2D(u_g0, v_texCoord);
	vec4 g1 = texture2D(u_g1, v_texCoord);
	vec4 g2 = vec4(0.);
	vec4 g3 = vec4(0.);

	GBufferContents g;
	decodeGBuffer(g, g0, g1, g2, g3);

	vec2 velocity = g.velocity * 0.1; // FIXME: why does 0.1 looks best?

	vec3 currentColor = texture2D(u_input, v_texCoord).xyz;

	highp vec2 curCoord = v_texCoord.xy;
#if c_useWiderFilter
	highp vec4 curCoord2 = curCoord.xyxy + vec4(u_globalDoubleInvRenderSize, -u_globalDoubleInvRenderSize);
	vec3 currentColor5 = texture2D(u_input, curCoord2.xy).xyz;
	vec3 currentColor6 = texture2D(u_input, curCoord2.xw).xyz;
	vec3 currentColor7 = texture2D(u_input, curCoord2.zy).xyz;
	vec3 currentColor8 = texture2D(u_input, curCoord2.zw).xyz;
	curCoord2 = curCoord.xyxy + vec4(u_globalInvRenderSize, -u_globalInvRenderSize);
#else
	highp vec4 curCoord2 = curCoord.xyxy + vec4(u_globalInvRenderSize, -u_globalInvRenderSize);
	vec3 currentColor5 = texture2D(u_input, curCoord2.xy).xyz;
	vec3 currentColor6 = texture2D(u_input, curCoord2.xw).xyz;
	vec3 currentColor7 = texture2D(u_input, curCoord2.zy).xyz;
	vec3 currentColor8 = texture2D(u_input, curCoord2.zw).xyz;
#endif
	vec3 currentColor1 = texture2D(u_input, vec2(curCoord.x, curCoord2.y)).xyz;
	vec3 currentColor2 = texture2D(u_input, vec2(curCoord.x, curCoord2.w)).xyz;
	vec3 currentColor3 = texture2D(u_input, vec2(curCoord2.x, curCoord.y)).xyz;
	vec3 currentColor4 = texture2D(u_input, vec2(curCoord2.z, curCoord.y)).xyz;

	highp vec2 oldCoord = v_texCoord - velocity;
	highp vec4 oldCoord2 = oldCoord.xyxy + vec4(u_globalQuadInvRenderSize, -u_globalQuadInvRenderSize);

	vec4 lastValue = texture2D(u_oldAccum, oldCoord);
	vec3 lastColor = lastValue.xyz;

#if 1
	vec3 currentColor0 = encodePalYuv(currentColor);
	currentColor1 = encodePalYuv(currentColor1);
	currentColor2 = encodePalYuv(currentColor2);
	currentColor3 = encodePalYuv(currentColor3);
	currentColor4 = encodePalYuv(currentColor4);
	currentColor5 = encodePalYuv(currentColor5);
	currentColor6 = encodePalYuv(currentColor6);
	currentColor7 = encodePalYuv(currentColor7);
	currentColor8 = encodePalYuv(currentColor8);

	vec3 minColor = min(min(currentColor1, currentColor2), min(currentColor3, min(currentColor4, currentColor0)));
	vec3 maxColor = max(max(currentColor1, currentColor2), max(currentColor3, max(currentColor4, currentColor0)));
	minColor = mix(minColor, min(min(currentColor5, currentColor6), min(currentColor7, min(currentColor8, minColor))), 0.5);
	maxColor = mix(maxColor, max(max(currentColor5, currentColor6), max(currentColor7, max(currentColor8, maxColor))), 0.5);

	vec3 oldLastColor = lastColor;
	lastColor = encodePalYuv(lastColor);
	lastColor = clamp(lastColor, minColor, maxColor);
	lastColor = decodePalYuv(lastColor);

	vec3 diffLastColor = oldLastColor - lastColor;
	lastValue.w *= 1. - dot(diffLastColor, diffLastColor); // warning: needs to be clamped if FP buffer is used
#else
	vec3 currentColor0 = currentColor;
	vec3 colorCentroid = (currentColor1 + currentColor2 + currentColor3 + currentColor4
	 + currentColor0 + currentColor5 + currentColor6 + currentColor7 + currentColor8 ) * (1. / 9.);
	currentColor1 -= colorCentroid; currentColor2 -= colorCentroid;
	currentColor3 -= colorCentroid; currentColor4 -= colorCentroid;
	currentColor5 -= colorCentroid; currentColor6 -= colorCentroid;
	currentColor7 -= colorCentroid; currentColor8 -= colorCentroid;
	currentColor0 -= colorCentroid;
	highp vec3 colorDist = abs(currentColor1) + abs(currentColor2) + abs(currentColor3) + abs(currentColor4)
		+ abs(currentColor0) + abs(currentColor5) + abs(currentColor6) + abs(currentColor7) + abs(currentColor8)
		+ .001 + colorCentroid * 0.01;
	colorDist = normalize(colorDist);
	vec3 subcolor = lastColor - colorCentroid;
	float subcolorDot = dot(subcolor, colorDist);
	float currentColor1Dot = dot(currentColor1, colorDist);
	float currentColor2Dot = dot(currentColor2, colorDist);
	float currentColor3Dot = dot(currentColor3, colorDist);
	float currentColor4Dot = dot(currentColor4, colorDist);
	float currentColor0Dot = dot(currentColor0, colorDist);
	float currentColor5Dot = dot(currentColor5, colorDist);
	float currentColor6Dot = dot(currentColor6, colorDist);
	float currentColor7Dot = dot(currentColor7, colorDist);
	float currentColor8Dot = dot(currentColor8, colorDist);
	float minDot = min(min(currentColor1Dot, currentColor2Dot), min(currentColor3Dot, min(currentColor4Dot, currentColor0Dot)));
	float maxDot = max(max(currentColor1Dot, currentColor2Dot), max(currentColor3Dot, max(currentColor4Dot, currentColor0Dot)));
	float minDot2 = min(min(currentColor5Dot, currentColor6Dot), min(currentColor7Dot, min(currentColor8Dot, minDot)));
	float maxDot2 = max(max(currentColor5Dot, currentColor6Dot), max(currentColor7Dot, max(currentColor8Dot, maxDot)));
	minDot = mix(minDot, minDot2, 1.); maxDot = mix(maxDot, maxDot2, 1.);
	subcolorDot = clamp(subcolorDot, minDot, maxDot);

	vec3 oldLastColor = lastColor;
	lastColor = colorCentroid + colorDist * subcolorDot;

	vec3 diffLastColor = oldLastColor - lastColor;
	lastValue.w *= 1. - dot(diffLastColor, diffLastColor); // warning: needs to be clamped if FP buffer is used

#endif

	// prevent ghosting
	float blendAmount = lastValue.w;
	blendAmount = min(blendAmount, texture2D(u_input, oldCoord2.xy).w);
	blendAmount = min(blendAmount, texture2D(u_input, oldCoord2.xw).w);
	blendAmount = min(blendAmount, texture2D(u_input, oldCoord2.zy).w);
	blendAmount = min(blendAmount, texture2D(u_input, oldCoord2.zw).w);

	gl_FragColor.xyz = mix(currentColor, lastColor, blendAmount);
	gl_FragColor.w = lastValue.w;
}
