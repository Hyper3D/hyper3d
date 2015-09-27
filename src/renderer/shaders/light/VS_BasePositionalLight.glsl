#pragma parameter hasShadowMap
#pragma parameter isFullScreen

#if c_isFullScreen
attribute vec2 a_position;
#endif

varying vec2 v_texCoord;
varying vec2 v_viewDir;
uniform vec2 u_viewDirCoefX;
uniform vec2 u_viewDirCoefY;
uniform vec2 u_viewDirOffset;
uniform vec2 u_ditherScale;
varying vec2 v_ditherCoord;
varying vec2 v_jitterCoord;

#if !c_isFullScreen
varying float v_w;
uniform mat4 u_viewProjectionMatrix;

vec3 computeWorldPosition();
#endif

void main()
{

#if c_isFullScreen
	gl_Position = vec4(a_position, 1., 1.);
	float v_w = 1.;
#else
	gl_Position = vec4(computeWorldPosition(), 1.);
	gl_Position = u_viewProjectionMatrix * gl_Position;
	v_w = gl_Position.w;
#endif

	v_texCoord = gl_Position.xy * 0.5 + 0.5;

	v_viewDir = u_viewDirOffset;
	v_viewDir += u_viewDirCoefX * gl_Position.x;
	v_viewDir += u_viewDirCoefY * gl_Position.y;

	v_ditherCoord.xy = u_ditherScale * gl_Position.xy;
	v_jitterCoord.xy = v_ditherCoord.xy + vec2(.1, .1);

	v_texCoord *= v_w;
	v_viewDir *= v_w;
	v_ditherCoord *= v_w;
	v_jitterCoord *= v_w;

}
