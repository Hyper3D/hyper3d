attribute vec2 a_position;
varying vec2 v_texCoord;
uniform vec4 u_uvScale;

varying vec2 v_vignetteCoord; // tangent
uniform vec2 u_vignetteScale;

void main()
{
	gl_Position = vec4(a_position, 0., 1.);
	v_texCoord = a_position * .5 + .5;

	v_vignetteCoord = a_position * u_vignetteScale;
}
