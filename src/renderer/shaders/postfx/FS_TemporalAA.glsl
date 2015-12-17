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

void main()
{
	
	vec4 g0 = texture2D(u_g0, v_texCoord);
	vec4 g1 = texture2D(u_g1, v_texCoord);
	vec4 g2 = vec4(0.);
	vec4 g3 = vec4(0.);

	GBufferContents g;
	decodeGBuffer(g, g0, g1, g2, g3);

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

	highp vec4 neighborCoords = curCoord.xyxy + vec4(u_globalQuadInvRenderSize, -u_globalQuadInvRenderSize);

	vec4 lastValue = texture2D(u_oldAccum, curCoord);
	vec3 lastColor = lastValue.xyz;

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
	lastValue.w *= max(0., 1. - dot(diffLastColor, diffLastColor) * 5.);

	// prevent ghosting
	float blendAmount = lastValue.w;
	blendAmount = min(blendAmount, texture2D(u_oldAccum, neighborCoords.xy).w);
	blendAmount = min(blendAmount, texture2D(u_oldAccum, neighborCoords.xw).w);
	blendAmount = min(blendAmount, texture2D(u_oldAccum, neighborCoords.zy).w);
	blendAmount = min(blendAmount, texture2D(u_oldAccum, neighborCoords.zw).w);

	gl_FragColor.xyz = mix(currentColor, lastColor, blendAmount);
	gl_FragColor.w = lastValue.w;
}
