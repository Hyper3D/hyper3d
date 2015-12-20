attribute vec2 a_position;

varying vec2 v_texCoord;

varying highp vec2 v_texCoord1;
varying highp vec2 v_texCoord2;
varying highp vec2 v_texCoord3;
varying highp vec2 v_texCoord4;
varying highp vec2 v_texCoord5;
varying highp vec2 v_texCoord6;

uniform vec2 u_texCoordOffset;

void main()
{
    gl_Position = vec4(a_position, 0., 1.);
    v_texCoord = a_position * 0.5 + 0.5;

    v_texCoord1 = v_texCoord + u_texCoordOffset;
    v_texCoord2 = v_texCoord - u_texCoordOffset;
    v_texCoord3 = v_texCoord1 + u_texCoordOffset;
    v_texCoord4 = v_texCoord2 - u_texCoordOffset;
    v_texCoord5 = v_texCoord3 + u_texCoordOffset;
    v_texCoord6 = v_texCoord4 - u_texCoordOffset;
}
