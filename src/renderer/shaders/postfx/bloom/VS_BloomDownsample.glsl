attribute vec2 a_position;
varying vec4 v_texCoord;
uniform vec2 u_texCoordOffset;

void main()
{
    gl_Position = vec4(a_position, 0., 1.);
    v_texCoord = (a_position * .5 + .5).xyxy;
    v_texCoord.xy -= u_texCoordOffset;
    v_texCoord.zw += u_texCoordOffset;
}
