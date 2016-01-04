#pragma parameter useNormalMap
#pragma require GBuffer
#pragma require FS_BaseGeometry

// prevent distorted reflection due to (probably) insufficient normal precision
// FIXME: this is too much
// --- precision highp ---

varying vec3 v_viewNormal;
#if c_useNormalMap
varying vec3 v_viewTangent;
varying vec3 v_viewBitangent;
#endif

varying highp vec4 v_screenPosition;
varying highp vec3 v_lastScreenPosition;

GBufferContents evaluateGeometry()
{
    evaluateMaterial();

    vec3 preshaded = m_emissive;
#if c_useNormalMap
    vec3 normal = v_viewNormal * m_normal.z;
    normal += v_viewTangent * m_normal.x;
    normal += v_viewBitangent * m_normal.y;
#else
    vec3 normal = v_viewNormal;
#endif
    normal = normalize(normal);

    highp vec2 screenPos = v_screenPosition.xy / v_screenPosition.z;
    highp vec2 lastScreenPos = v_lastScreenPosition.xy / v_lastScreenPosition.z;
    vec2 screenVel = screenPos - lastScreenPos;

    GBufferContents g;
    g.albedo = m_albedo;
    g.normal = normal;
    g.velocity = screenVel;
    g.roughness = m_roughness;
    g.metallic = m_metallic;
    g.specular = m_specular;
    g.preshaded = preshaded;
    g.materialId = m_materialId;
    g.materialParam = m_materialParam;

    return g;
}
