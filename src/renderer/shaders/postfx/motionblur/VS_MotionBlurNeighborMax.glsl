attribute vec2 a_position;
varying vec2 v_texCoord1;
varying vec4 v_texCoord2;
uniform vec2 u_texCoordOffset;

void main()
{
	gl_Position = vec4(a_position, 0., 1.);
	v_texCoord1 = a_position * .5 + .5;
	v_texCoord2 = v_texCoord1.xyxy + vec4(u_texCoordOffset, -u_texCoordOffset);
}
