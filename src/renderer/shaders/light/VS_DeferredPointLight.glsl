#pragma require VS_BasePositionalLight

#if !c_isFullScreen
attribute vec3 a_position;

uniform vec3 u_lightPos;
uniform float u_lightInfluenceRadius;

vec3 computeWorldPosition()
{
    return u_lightPos + a_position * u_lightInfluenceRadius;
}
#endif
