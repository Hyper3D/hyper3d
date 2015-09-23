#pragma require Constants
#pragma require GBuffer

struct PointLightBRDFParameters
{
	float nhDot;
	float nlDot;
	float nvDot;
	float hlDot;
};

struct UniformLightBRDFParameters
{
	float nvDot;
};

struct MaterialInfo
{
	vec3 albedo;
	float roughness;
	float metallic;
	float specular;
};

float evaluateGGXSpecularDistribution(float nhDot, float roughness)
{
	// Walter et al. 2007, "Microfacet models for refraction through rough surfaces"
	// http://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf
	float a = roughness * roughness;
	highp float aa = a * a;
	highp float t = nhDot * nhDot * (aa - 1.) + 1.;
	return aa /
		(t * t);
}

float evaluateLambertDiffuse(float nlDot)
{
	return 1.;
}

float evaluateDisneyPrincipledDiffuse(float nlDot, float nvDot, float hlDot, float roughness)
{
	float fd90m1 = -0.5 + hlDot * hlDot * 2. * roughness;
	float f1a = 1. - nlDot, f2a = 1. - nvDot;
	float f1b = f1a * f1a, f2b = f2a * f2a;
	float f1 = f1a * f1b * f1b, f2 = f2a * f2b * f2b;
	return (1. + fd90m1 * f1) * (1. + fd90m1 * f2) * nlDot;
}

float evaluateSchlickFresnel(float hlDot)
{
	float t = 1. - hlDot;
	float tt = t * t;
	return tt * tt * t;
}

// evaluateXXXGeometryShadowing evaluates G(l, v, h) / (n dot v).
float evaluateBeckmannGeometryShadowing(float nlDot, float nvDot, float roughness)
{
	// http://graphicrants.blogspot.jp/2013/08/specular-brdf-reference.html
	float lct = .5 / (roughness * sqrt(1. - nlDot * nlDot));
	float vct = .5 / (roughness * sqrt(1. - nvDot * nvDot));
	float lc = lct * nlDot, vc = vct * nvDot;
	float a = 3.353 * lc + 2.181 * lc * lc; // not typo
	a *= 3.353 * vct + 2.181 * vct * vc;
	float b = 1. + 2.276 * lc + 2.577 * lc * lc;
	b *= 1. + 2.276 * vc + 2.577 * vc * vc;
	return a / b;
}

vec3 evaluatePointLight(
	PointLightBRDFParameters params,
	MaterialInfo material,
	vec3 lightColor)
{
	if (params.nlDot <= 0.) {
		return vec3(0.);
	}

	float fresnel = evaluateSchlickFresnel(params.hlDot);

	vec3 minRefl = mix(vec3(material.specular), material.albedo, material.metallic);
	vec3 refl = mix(minRefl, vec3(1.), fresnel);

	float diffuseMix = 1. - material.metallic;
	diffuseMix *= evaluateDisneyPrincipledDiffuse(params.nlDot, params.nvDot, params.hlDot, material.roughness);

	float specular = evaluateGGXSpecularDistribution(params.nhDot, material.roughness);
	specular *= evaluateBeckmannGeometryShadowing(params.nlDot, params.nvDot, material.roughness);

	diffuseMix *= params.nlDot; specular *= params.nlDot;

	vec3 diffuse = material.albedo;

	vec3 final = diffuse * diffuseMix + refl * specular;
	return final * lightColor;
}

vec3 evaluateUniformLight(
	UniformLightBRDFParameters params,
	MaterialInfo material,
	vec3 lightColor)
{
	// FIXME: verify this model
	float fresnel = evaluateSchlickFresnel(params.nvDot);

	vec3 minRefl = mix(vec3(material.specular), material.albedo, material.metallic);
	vec3 refl = mix(minRefl, vec3(1.), fresnel);

	float diffuseMix = 1. - material.metallic;

	vec3 diffuse = material.albedo;

	vec3 final = diffuse * diffuseMix;
	return final * lightColor;
}

vec4 evaluateReflection(
	float nvDot,
	MaterialInfo material)
{
	// assume h = n now
	float fresnel = evaluateSchlickFresnel(nvDot);

	vec3 minRefl = mix(vec3(material.specular), material.albedo, material.metallic);
	vec4 refl = vec4(mix(minRefl, vec3(1.), fresnel), 1.);

	refl *= evaluateBeckmannGeometryShadowing(nvDot, nvDot, material.roughness); // FIXME: optimize?

	return refl;
}

PointLightBRDFParameters computePointLightBRDFParameters(
	vec3 normal, vec3 light, vec3 view)
{
	vec3 halfVec = normalize(light + view);
	return PointLightBRDFParameters(
		clamp(dot(normal, halfVec), 0., 1.), 
		clamp(dot(normal, light), 0., 1.), 
		clamp(dot(normal, view), 0., 1.),
		clamp(dot(halfVec, light), 0., 1.));
}

UniformLightBRDFParameters computeUniformLightBRDFParameters(
	vec3 normal, vec3 view)
{
	UniformLightBRDFParameters ret;
	ret.nvDot = clamp(dot(normal, view), 0., 1.);
	return ret;
}

MaterialInfo getMaterialInfoFromGBuffer(GBufferContents g)
{
	return MaterialInfo(g.albedo, mix(0.001, 1., g.roughness), g.metallic, g.specular);
}

