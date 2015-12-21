attribute vec2 a_position;
varying vec2 v_texCoord;
varying highp vec2 v_dustCoord;
uniform vec2 u_dustScale;

void main()
{
    gl_Position = vec4(a_position, 0., 1.);
    v_texCoord = a_position * .5 + .5;
    v_dustCoord = a_position * u_dustScale + .5;
}
