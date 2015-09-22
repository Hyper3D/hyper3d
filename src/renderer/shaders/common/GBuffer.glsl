#pragma parameter globalSupportsSRGB
#pragma require SphereMap
#pragma require Pack

struct GBufferContents
{
	vec3 albedo;
	vec3 normal;
	vec2 velocity;
	float roughness;
	float metallic;
	float specular;

	vec3 preshaded;
	float aoRatio;
};

vec3 decodeGBufferNormal(vec4 g2)
{
	return decodeSpheremap(vec2(unpack16(g2.xy), unpack16(g2.zw)));
}

void decodeGBuffer(out GBufferContents g, vec4 g0, vec4 g1, vec4 g2, vec4 g3)
{
	g.albedo = g0.xyz;
#if !c_globalSupportsSRGB
	g.albedo *= g.albedo;
#endif

	g.normal = decodeGBufferNormal(g2);

	g.velocity = vec2(g0.w, g1.w);

	g.roughness = g1.x * g1.x;
	g.metallic = g1.y;
	g.specular = g1.z;

	g.preshaded = g3.xyz;
	g.aoRatio = g3.w;
}

void encodeGBuffer(out vec4 g0, out vec4 g1, out vec4 g2, out vec4 g3, GBufferContents g)
{
	vec2 sphereMap = encodeSpheremap(g.normal);

	g0 = vec4(g.albedo, g.velocity.x);
	g1 = vec4(sqrt(g.roughness), g.metallic, g.specular, g.velocity.y);
	g2 = vec4(pack16(sphereMap.x), pack16(sphereMap.y));
	g3 = vec4(g.preshaded, g.aoRatio);
}

bool isGBufferEmpty(vec4 g0, vec4 g1, vec4 g2, vec4 g3)
{
	return g2.x < .001;
}