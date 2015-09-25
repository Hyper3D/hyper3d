attribute vec2 a_position;
varying vec2 v_texCoord;

uniform vec2 u_jitterScale;
varying vec2 v_jitterCoord;

void main()
{
	gl_Position = vec4(a_position, 0., 1.);
	v_texCoord = a_position * .5 + .5;

	v_jitterCoord = v_texCoord * u_jitterScale;
}
