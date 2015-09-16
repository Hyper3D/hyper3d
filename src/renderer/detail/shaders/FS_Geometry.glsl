#pragma parameter useNormalMap
#pragma require Pack16
#pragma require SphereMap
#pragma require GBufferMosaic

varying vec3 v_viewNormal;
#if c_useNormalMap
varying vec3 v_viewTangent;
varying vec3 v_viewBitangent;
#endif
varying vec2 v_screenVelocity;

vec3 m_albedo;
float m_roughness;
float m_metallic;
float m_specular;
vec3 m_normal;
vec3 m_emissive;
vec3 m_radiosity;

void evaluateShader();

void main()
{
	m_albedo = vec3(1.);
	m_roughness = 0.2;
	m_metallic = 0.2;
	m_specular = 0.;
	m_normal = vec3(0., 0., 1.);
	m_radiosity = vec3(0.);
	m_emissive = vec3(0.);

	evaluateShader();
	
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
	vec2 sphereMap = encodeSpheremap(normal);
	
	vec4 g0 = vec4(m_albedo, v_screenVelocity.x);
	vec4 g1 = vec4(m_roughness, m_metallic, m_specular, v_screenVelocity.y);
	vec4 g2 = vec4(pack16(sphereMap.x), pack16(sphereMap.y));
	vec4 g3 = vec4(preshaded, aoRatio);

	// mosaiced G-Buffer is not sRGB buffer, so
	// we have to convert color to gamma space to
	// prevent the loss of precision
	g0.xyz = sqrt(g0.xyz);
	g3.xyz = sqrt(g3.xyz);
	
	gl_FragColor = encodeGBufferMosaic(g0, g1, g2, g3);
}
