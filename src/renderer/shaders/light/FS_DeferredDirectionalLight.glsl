#pragma parameter hasShadow

#pragma require GBuffer
#pragma require ShadingModel
#pragma require DepthFetch
#pragma require FS_BasePointLight

uniform vec3 u_lightDir;

#if c_hasShadow
uniform sampler2D u_shadow;
#endif

void main()
{
    setupLight();
    setupPointLight();

#if c_hasShadow

    float shadowValue = texture2D(u_shadow, v_texCoord).x;
    if (shadowValue < 0.0001) {
        discard;
    }

#else // c_hasShadow

    float shadowValue = 1.;

#endif // c_hasShadow

    doPointLight(u_lightDir, shadowValue * u_lightStrength);

}
