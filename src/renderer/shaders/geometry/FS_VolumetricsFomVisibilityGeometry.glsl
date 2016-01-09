#pragma require FS_BaseGeometry
#pragma parameter useThickness
#pragma require DepthFetch
#pragma require FourierOpacityMapping

uniform sampler2D u_linearDepth;

varying highp float v_depth;

FomCoefs evaluateFomCoefs()
{
    highp float depth = fetchDepth(u_linearDepth, gl_FragCoord.xy * u_globalInvRenderSize);
    if (v_depth > depth) {
        discard;
    }

    evaluateMaterial();

    float depthScale = 1. / depth;

#if c_useThickness
    float endDepth = min(v_depth + m_thickness, depth);

    FomCoefs coef1 = fomCoefImpulse(v_depth * depthScale);
    FomCoefs coef2 = fomCoefImpulse(endDepth * depthScale);

    FomCoefs iCoef1 = fomCoefIntegrate(coef1, 2. * m_density);
    FomCoefs iCoef2 = fomCoefIntegrate(coef2, 2. * m_density);

    FomCoefs coef = fomCoefSub(iCoef2, iCoef1);
    coef.c0 = 2. * m_density * (endDepth - v_depth) * depthScale;
#else
    FomCoefs coef = fomCoefImpulse(v_depth * depthScale);
    coef = fomCoefScale(coef, 2. * m_density * depthScale);
#endif
    
    return coef;
}
