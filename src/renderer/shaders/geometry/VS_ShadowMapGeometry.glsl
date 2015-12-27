
#pragma require VS_BaseGeometry

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;


void main()
{
    evaluateGeometry();

    gl_Position = u_viewProjectionMatrix * vec4(worldPosition, 1.);
    gl_Position.z += 0.001 * gl_Position.w; // polygonOffset sometimes doesn't work well?
}

