attribute vec2 a_position;
varying vec3 v_dir;
uniform vec3 u_axisMajor;
uniform vec3 u_axisU;
uniform vec3 u_axisV;
varying vec2 v_jitterCoord;
uniform float u_jitterScale;

void main()
{
    gl_Position = vec4(a_position, 0., 1.);

    v_jitterCoord = a_position * u_jitterScale;

    v_dir = u_axisMajor;
    v_dir += u_axisU * a_position.x;
    v_dir += u_axisV * a_position.y;
}
