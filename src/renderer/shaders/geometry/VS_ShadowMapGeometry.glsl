
#pragma require VS_BaseGeometry

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;


void main()
{
    evaluateGeometry();

    gl_Position = u_viewProjectionMatrix * vec4(worldPosition, 1.);
}

