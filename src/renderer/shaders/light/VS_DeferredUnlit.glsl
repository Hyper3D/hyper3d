attribute vec2 a_position;
varying vec2 v_texCoord;
uniform vec2 u_ditherScale;
varying vec2 v_ditherCoord;
varying vec2 v_viewDir;

void main()
{
    gl_Position = vec4(a_position, 1., 1.);
    v_texCoord = a_position * 0.5 + 0.5;

    v_ditherCoord.xy = u_ditherScale * a_position;

    v_viewDir = vec2(0.); // unused by required by FS_BaseLight
}
