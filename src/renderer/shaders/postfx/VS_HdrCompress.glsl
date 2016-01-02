attribute vec2 a_position;
varying vec2 v_texCoord;
varying vec2 v_jitterCoord;
uniform vec2 u_jitterScale;

void main()
{
    gl_Position = vec4(a_position, 0., 1.);
    v_texCoord = a_position * 0.5 + 0.5;
    v_jitterCoord = v_texCoord * u_jitterScale;
}
