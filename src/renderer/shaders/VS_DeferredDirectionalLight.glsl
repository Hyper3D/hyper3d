#pragma parameter hasShadowMap

attribute vec2 a_position;
varying vec2 v_texCoord;
varying vec2 v_viewDir;
uniform vec2 u_viewDirCoefX;
uniform vec2 u_viewDirCoefY;
uniform vec2 u_viewDirOffset;

#if c_hasShadowMap
uniform vec2 u_jitterScale;
varying vec4 v_jitterCoord;
#endif

void main()
{
	gl_Position = vec4(a_position, 1., 1.);
	v_texCoord = a_position * 0.5 + 0.5;

	v_viewDir = u_viewDirOffset;
	v_viewDir += u_viewDirCoefX * a_position.x;
	v_viewDir += u_viewDirCoefY * a_position.y;

#if c_hasShadowMap
	v_jitterCoord.xy = u_jitterScale * a_position;
	v_jitterCoord.zw = v_jitterCoord.xy + vec2(.1, .1);
#endif
}
