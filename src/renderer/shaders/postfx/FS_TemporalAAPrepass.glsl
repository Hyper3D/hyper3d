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

void main()
{
	vec4 g0 = texture2D(u_g0, v_texCoord);
	vec4 g1 = texture2D(u_g1, v_texCoord);
	vec4 g2 = vec4(0.);
	vec4 g3 = vec4(0.);

	// FIXME: this won't work without full G-buffer!
	/* if (isGBufferEmpty(g0, g1, g2, g3)) { 
		// velocity might contain invalid value because
		// it's not cleared properly. (see GeometryRenderer)
		g0.w = 0.5; g1.w = 0.5;
	} */

	GBufferContents g;
	decodeGBuffer(g, g0, g1, g2, g3);

	vec2 velocity = g.velocity * 0.5;
	float velocityLen = length(velocity * u_globalRenderSize);

	highp vec2 oldCoord = v_texCoord - velocity;
	highp vec4 oldCoord2 = oldCoord.xyxy + vec4(u_globalInvRenderSize, -u_globalInvRenderSize);

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
	blendAmt = mix(blendAmt, .95, .5);

	gl_FragColor.w = blendAmt;
}
