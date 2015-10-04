#pragma parameter globalSupportsSRGB
#pragma require SphereMap
#pragma require Pack
#pragma require VelocityMap

struct GBufferContents
{
	vec3 albedo;
	vec3 normal;
	vec2 velocity;
	float roughness;
	float metallic;
	float specular;
	float materialId;
	float materialParam;

	vec3 preshaded;
};

vec3 decodeGBufferNormal(vec4 g2)
{
	return decodeSpheremap(unpack12x2(g2.xyz));
}

void decodeGBuffer(out GBufferContents g, vec4 g0, vec4 g1, vec4 g2, vec4 g3)
{
	g.albedo = g0.xyz;
#if !c_globalSupportsSRGB
	g.albedo *= g.albedo;
#endif

	g.normal = decodeGBufferNormal(g2);

	g.velocity = decodeVelocityMap(vec2(g0.w, g1.w));

	g.roughness = g1.x * g1.x;
	g.metallic = g1.y;
	g.specular = g1.z;

	float t = g1.y * (255.5 / 16.);
	g.materialId = floor(t);
	g.metallic = floor(fract(t) * 16.) * (1. / 15.);

	g.materialParam = g2.w;

	g.preshaded = g3.xyz * exp2(g3.w * 255. - 128.);
}

void encodeGBuffer(out vec4 g0, out vec4 g1, out vec4 g2, out vec4 g3, GBufferContents g)
{
	vec2 sphereMap = encodeSpheremap(g.normal);
	vec2 vel = encodeVelocityMap(g.velocity);

	vec3 preshaded = g.preshaded;
	float lum = max(max(max(preshaded.x, preshaded.y), preshaded.z), 0.0001);
	float lumLog = ceil(log2(lum));
	preshaded *= exp2(-lumLog);

	g0 = vec4(g.albedo, vel.x);
	g1 = vec4(sqrt(g.roughness), 
		floor(g.metallic * 15.5) * (1. / 255.) + g.materialId * (16. / 255.), 
		g.specular, 
		vel.y);
	g2 = vec4(pack12x2(sphereMap), g.materialParam);
	g3 = vec4(preshaded, (lumLog + 128.) * (1. / 255.));
}

bool isGBufferEmpty(vec4 g0, vec4 g1, vec4 g2, vec4 g3)
{
	return g2.x < .001;
}