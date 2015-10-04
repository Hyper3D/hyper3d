#pragma parameter useNormalMap
#pragma require GBuffer
#pragma require GBufferMosaic
#pragma require FS_BaseGeometry

varying vec3 v_viewNormal;
#if c_useNormalMap
varying vec3 v_viewTangent;
varying vec3 v_viewBitangent;
#endif

varying highp vec3 v_screenPosition;
varying highp vec3 v_lastScreenPosition;

void main()
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

	vec4 g0, g1, g2, g3;

	encodeGBuffer(g0, g1, g2, g3, g);

	// mosaiced G-Buffer is not sRGB buffer, so
	// we have to convert color to gamma space to
	// prevent the loss of precision
	g0.xyz = sqrt(g0.xyz);
	g3.xyz = sqrt(g3.xyz);
	
	gl_FragColor = encodeGBufferMosaic(g0, g1, g2, g3);
}
