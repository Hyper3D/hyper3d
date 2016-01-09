#pragma parameter useNormalMap
#pragma require FS_BaseGeometry
#pragma parameter useThickness
#pragma require DepthFetch

uniform sampler2D u_linearDepth;

varying highp float v_depth;

void main()
{
    highp float depth = fetchDepth(u_linearDepth, gl_FragCoord.xy * u_globalInvRenderSize);
    if (v_depth > depth) {
        discard;
    }

    evaluateMaterial();

    // TODO: lighting
    vec3 color = m_albedo;

    float density = m_density;
#if c_useThickness
    density *= min(depth - v_depth, m_thickness);
#endif
    
    float alpha = 1. - exp2(-density);
    gl_FragColor.w = alpha * .5;
    gl_FragColor.xyz = alpha * color + m_emissive * density;
}
