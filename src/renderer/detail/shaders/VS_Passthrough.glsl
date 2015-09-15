attribute vec2 a_position;
varying vec2 v_texCoord;
uniform vec4 u_uvScale;
void main()
{
	gl_Position = vec4(a_position, 0., 1.);
	v_texCoord = a_position * u_uvScale.xy + u_uvScale.zw;
}
