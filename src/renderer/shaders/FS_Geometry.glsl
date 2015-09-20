#pragma parameter useNormalMap
#pragma require GBuffer
#pragma require GBufferMosaic
#pragma require FS_BaseGeometry

varying vec3 v_viewNormal;
#if c_useNormalMap
varying vec3 v_viewTangent;
varying vec3 v_viewBitangent;
#endif
varying vec2 v_screenVelocity;

void main()
{
	evaluateMaterial();
	
	vec3 preshaded = m_emissive + m_radiosity;
	float aoRatio = dot(m_radiosity, vec3(1.)) / dot(m_emissive, vec3(1.));
#if c_useNormalMap
	vec3 normal = v_viewNormal * m_normal.z;
	normal += v_viewTangent * m_normal.x;
	normal += v_viewBitangent * m_normal.y;
#else
	vec3 normal = v_viewNormal;
#endif
	normal = normalize(normal);
	
	GBufferContents g;
	g.albedo = m_albedo;
	g.normal = normal;
	g.velocity = v_screenVelocity;
	g.roughness = m_roughness;
	g.metallic = m_metallic;
	g.specular = m_specular;
	g.preshaded = preshaded;
	g.aoRatio = aoRatio;

	vec4 g0, g1, g2, g3;

	encodeGBuffer(g0, g1, g2, g3, g);

	// mosaiced G-Buffer is not sRGB buffer, so
	// we have to convert color to gamma space to
	// prevent the loss of precision
	g0.xyz = sqrt(g0.xyz);
	g3.xyz = sqrt(g3.xyz);
	
	gl_FragColor = encodeGBufferMosaic(g0, g1, g2, g3);
}
