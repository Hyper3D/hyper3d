#pragma require DepthFetch

uniform sampler2D u_linearDepth;
uniform sampler2D u_lowResLinearDepth;
uniform sampler2D u_volumeColor;
uniform sampler2D u_fomCoef1;

varying highp vec2 v_texCoord;

void main()
{
    highp float depth = fetchDepth(u_linearDepth, gl_FragCoord.xy * u_globalInvRenderSize);

	// TODO: nearest depth search
	
	float dcCoef = texture2D(u_fomCoef1, v_texCoord).x;
	float desiredAlpha = 1. - exp2(-dcCoef * depth);

	vec4 color = texture2D(u_volumeColor, v_texCoord);
	if (color.w > 0.00001) {
		color *= desiredAlpha / color.w;
	}
	
    gl_FragColor = color;
}
