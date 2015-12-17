#pragma require Globals
#pragma require GBuffer
#pragma require DepthFetch

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

vec3 fetchVelocity(highp vec2 coord)
{
	vec4 g0 = texture2D(u_g0, coord);
	vec4 g1 = texture2D(u_g1, coord);
	vec4 g2 = vec4(0.);
	vec4 g3 = vec4(0.);

	GBufferContents g;
	decodeGBuffer(g, g0, g1, g2, g3);

	return vec3(g.velocity * 0.5, dot(g.velocity, g.velocity));
}

void main()
{
	// velocity dilation
	vec4 coords = vec4(v_texCoord.xyxy + vec4(u_globalInvRenderSize, -u_globalInvRenderSize));
	vec3 best = fetchVelocity(v_texCoord.xy);
	{
		vec3 v = fetchVelocity(coords.xy);
		if (v.z > best.z) best = v;
	}
	{
		vec3 v = fetchVelocity(coords.zy);
		if (v.z > best.z) best = v;
	}
	{
		vec3 v = fetchVelocity(coords.xw);
		if (v.z > best.z) best = v;
	}
	{
		vec3 v = fetchVelocity(coords.zw);
		if (v.z > best.z) best = v;
	}

	vec2 velocity = best.xy;
	float velocityLen = length(velocity * u_globalRenderSize);

	highp vec2 oldCoord = v_texCoord - velocity;

	vec4 lastValue = texture2D(u_oldAccum, oldCoord);
	vec3 lastColor = lastValue.xyz;

	gl_FragColor.xyz = lastColor;

	if (oldCoord.x < 0. || oldCoord.x > 1. ||
		oldCoord.y < 0. || oldCoord.y > 1. ||
		velocityLen > 50.) {
		// too much movement. reset blend amount
		gl_FragColor.w = 0.0;
		return;
	}

	float blendAmt = lastValue.w;
	blendAmt = 1. / (1.001 - blendAmt);
	blendAmt += 1.;
	blendAmt = min(1.001 - 1. / blendAmt, 1.);

	gl_FragColor.w = blendAmt;
}
