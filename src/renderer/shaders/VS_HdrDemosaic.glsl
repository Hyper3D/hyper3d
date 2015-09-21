#pragma require Globals

attribute vec2 a_position;
varying vec2 v_texCoord1;
varying vec2 v_texCoord2;
varying vec2 v_texCoord3;

void main()
{
	gl_Position = vec4(a_position, 0., 1.);

	vec2 normCoord = a_position * 0.5 + 0.5;

	v_texCoord1 = normCoord;
	v_texCoord2 = normCoord - u_globalInvRenderSize;
	v_texCoord3 = normCoord + u_globalInvRenderSize;
}
