// this shader is abstract; must be imported and main function must be provided

vec3 m_albedo;
float m_roughness;
float m_metallic;
float m_specular;
vec3 m_normal;
vec3 m_emissive;
float m_materialId;
float m_materialParam;
float m_density;
float m_thickness;

varying highp vec3 v_worldPosition;

vec2 v_pointCoord;

void evaluateFragmentShader();

void evaluateMaterial()
{
    m_albedo = vec3(1.);
    m_roughness = 0.2;
    m_metallic = 0.2;
    m_specular = 0.03;
    m_normal = vec3(0., 0., 1.);
    m_emissive = vec3(0.);
    m_materialId = 0.;
    m_materialParam = 0.;
    m_density = 1.;
    m_thickness = 1.;

    v_pointCoord = gl_PointCoord;

    evaluateFragmentShader();
}
