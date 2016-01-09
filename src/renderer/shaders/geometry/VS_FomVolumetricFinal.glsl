attribute vec2 a_position;
varying vec2 v_texCoord;

void main()
{
    gl_Position = vec4(a_position, 1., 1.);
    v_texCoord = a_position * 0.5 + 0.5;
}
