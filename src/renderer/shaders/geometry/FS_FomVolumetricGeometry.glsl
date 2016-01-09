#pragma parameter useNormalMap
#pragma require FS_BaseGeometry
#pragma parameter useThickness
#pragma require DepthFetch
#pragma require VolumeTexture2D
#pragma require FourierOpacityMapping

uniform sampler2D u_linearDepth;

uniform sampler2D u_lightVolume;
uniform vec4 u_lightVolumeParams;

uniform sampler2D u_fomCoef1;
uniform sampler2D u_fomCoef2;
uniform sampler2D u_fomCoef3;
uniform sampler2D u_fomCoef4;

varying highp vec4 v_position;
varying highp float v_depth;

void main()
{
    highp vec2 texCoord = gl_FragCoord.xy * u_globalInvRenderSize;
    highp float depth = fetchDepth(u_linearDepth, texCoord);
    if (v_depth + 0.00001 > depth) {
        discard;
    }

    evaluateMaterial();

    vec3 color = m_albedo;
    vec3 lightCoord = (v_position.xyz / v_position.w) * .5 + .5;
    vec3 light = sampleVolumeTexture2D(u_lightVolume, lightCoord, u_lightVolumeParams).xyz;
    color *= light;

    vec4 cf1 = texture2D(u_fomCoef1, texCoord);
    vec4 cf2 = texture2D(u_fomCoef2, texCoord);
    vec4 cf3 = texture2D(u_fomCoef3, texCoord);
    vec4 cf4 = texture2D(u_fomCoef4, texCoord);
    FomCoefs coefs = FomCoefs(cf1.x, cf1.zw,
        cf2.xy, cf2.zw, cf3.xy, cf3.zw, cf4.xy, cf4.zw);

    float density;
    float depthScale = 1. / depth;

#if c_useThickness
    float endDepth = min(v_depth + m_thickness, depth);
    float scaledDepth1 = v_depth * depthScale * 0.8;
    float scaledDepth2 = endDepth * depthScale;

    FomCoefs coef0 = fomCoefImpulse(0.);
    FomCoefs coef1 = fomCoefImpulse(scaledDepth1);
    FomCoefs coef2 = fomCoefImpulse(scaledDepth2);

    FomCoefs iCoef0 = fomCoefIntegrate(coef0, 1.);
    FomCoefs iCoef1 = fomCoefIntegrate(coef1, 1.);
    FomCoefs iCoef2 = fomCoefIntegrate(coef2, 1.);

    FomCoefs iCoefFront = fomCoefSub(iCoef1, iCoef0);
    FomCoefs iCoefMid = fomCoefSub(iCoef2, iCoef1);

    float avgDensity = fomCoefDefiniteIntegrate(coefs, iCoefMid, scaledDepth2 - scaledDepth1) * depth;
    avgDensity = max(0., m_density * (endDepth - v_depth));

    density = exp2(-max(fomCoefDefiniteIntegrate(coefs, iCoefFront, scaledDepth1) * depth, 0.));
    density *= (1. - exp2(-avgDensity)) * (scaledDepth2 - scaledDepth1) / avgDensity;
    gl_FragColor.xyz = vec3(-log2(density));
    gl_FragColor.y = avgDensity / (scaledDepth2 - scaledDepth1);
    // return;
#else
    float scaledDepth1 = v_depth * depthScale;

    FomCoefs coef0 = fomCoefImpulse(0.);
    FomCoefs coef1 = fomCoefImpulse(scaledDepth1);

    FomCoefs iCoef0 = fomCoefIntegrate(coef0, 1.);
    FomCoefs iCoef1 = fomCoefIntegrate(coef1, 1.);

    FomCoefs iCoefFront = fomCoefSub(iCoef1, iCoef0);

    density = exp2(-max(fomCoefDefiniteIntegrate(coefs, iCoefFront, scaledDepth1) * depth, 0.));
#endif
    gl_FragColor.w = density * m_density;
    gl_FragColor.xyz = color * (density * m_density) + m_emissive * density;
}
