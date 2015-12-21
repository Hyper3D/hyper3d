#pragma parameter hasShadowMap

#pragma require GBuffer
#pragma require ShadingModel
#pragma require DepthFetch
#pragma require FS_BasePointLight
#pragma require ShadowTexture

uniform vec3 u_lightDir;

#if c_hasShadowMap
uniform highp sampler2D u_shadowMap;
uniform sampler2D u_jitter;
uniform mat4 u_shadowMapMatrix;
uniform vec4 u_jitterAmount;
varying vec2 v_jitterCoord;
#endif

void main()
{
    setupLight();
    setupPointLight();

#if c_hasShadowMap

    highp vec3 viewPos = viewPos;
    highp vec3 shadowCoord = (u_shadowMapMatrix * vec4(viewPos, 1.)).xyz; // w is always 1 for orthographic camera

    float shadowValue = 0.;
    vec4 jitter1 = texture2D(u_jitter, v_ditherCoord.xy) - 0.5;
    vec4 jitter2 = texture2D(u_jitter, v_jitterCoord.xy) - 0.5;

    jitter1 *= u_jitterAmount.xyxy;
    jitter2 *= u_jitterAmount.xyxy;

    shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(u_jitterAmount.z, u_jitterAmount.w, 0.));
    shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(u_jitterAmount.z, -u_jitterAmount.w, 0.));
    shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(-u_jitterAmount.z, u_jitterAmount.w, 0.));
    shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(-u_jitterAmount.z, -u_jitterAmount.w, 0.));

    if (shadowValue < 0.0001) {
        discard;
    }

    if (shadowValue < 3.9) {
        // near border; many samples
        shadowValue = 0.;
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.xy, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.zw, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.xy, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.zw, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.xw, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.zy, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.xw, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.zy, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.yx, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.wz, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.yx, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.wz, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.wx, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter1.yz, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.wx, 0.));
        shadowValue += shadowTexture2D(u_shadowMap, shadowCoord + vec3(jitter2.yz, 0.));
        shadowValue *= 1. / 16.;
    } else {
        shadowValue *= 1. / 4.;
    }

#else // c_hasShadowMap

    float shadowValue = 1.;

#endif // c_hasShadowMap

    doPointLight(u_lightDir, shadowValue * u_lightStrength);

}
