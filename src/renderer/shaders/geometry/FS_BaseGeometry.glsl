// this shader is abstract; must be imported and main function must be provided

vec3 m_albedo;
float m_roughness;
float m_metallic;
float m_specular;
vec3 m_normal;
vec3 m_emissive;
vec3 m_radiosity;
float m_materialId;

void evaluateShader();

void evaluateMaterial()
{
	m_albedo = vec3(1.);
	m_roughness = 0.2;
	m_metallic = 0.2;
	m_specular = 0.;
	m_normal = vec3(0., 0., 1.);
	m_radiosity = vec3(0.);
	m_emissive = vec3(0.);
	m_materialId = 0.;

	evaluateShader();
}
