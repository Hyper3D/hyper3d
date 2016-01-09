
attribute vec3 a_position;
uniform vec4 u_v2dSize;
uniform vec4 u_v2dRange;

vec3 v2dCoord;

/** To be called from a vertex shader. */
void setupVolumeTexture2DFill()
{
	vec2 cd = a_position.xy * 0.5 + 0.5;
	v2dCoord.xy = mix(u_v2dRange.xy, u_v2dRange.zw, cd);
	v2dCoord.z = (a_position.z + .5) * u_v2dSize.z * u_v2dSize.w;

	float row = floor(a_position.z * u_v2dSize.z);
	float col = a_position.z - row * u_v2dSize.x;

	gl_Position.xy = (v2dCoord.xy + vec2(col, row)) * u_v2dSize.zw * 2. - 1.;
	gl_Position.zw = vec2(1.);
}
