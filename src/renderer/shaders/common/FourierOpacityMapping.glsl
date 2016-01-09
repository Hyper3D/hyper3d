#pragma require Complex
#pragma require Constants

struct FomCoefs
{
	float c0;
	vec2 c1;
	vec2 c2;
	vec2 c3;
	vec2 c4;
	vec2 c5;
	vec2 c6;
	vec2 c7;
};

FomCoefs fomCoefZero()
{
	return FomCoefs(0., vec2(0.), vec2(0.), vec2(0.), vec2(0.), vec2(0.), vec2(0.), vec2(0.));
}

FomCoefs fomCoefImpulse(float theta)
{
	FomCoefs ret;

	theta *= M_PI * 2.;

	ret.c0 = 1.;
	ret.c1 = vec2(cos(theta), sin(theta));
	ret.c2 = complexMultiply(ret.c1, ret.c1);
	ret.c3 = complexMultiply(ret.c2, ret.c1);
	ret.c4 = complexMultiply(ret.c2, ret.c2);
	ret.c5 = complexMultiply(ret.c3, ret.c2);
	ret.c6 = complexMultiply(ret.c3, ret.c3);
	ret.c7 = complexMultiply(ret.c4, ret.c3);

	return ret;
}

FomCoefs fomCoefIntegrate(FomCoefs coef, float scale)
{
	coef.c0 = 0.;
	coef.c1 = vec2(coef.c1.y, -coef.c1.x) * (1. / (M_PI * 2. * 1.) * scale);
	coef.c2 = vec2(coef.c2.y, -coef.c2.x) * (1. / (M_PI * 2. * 2.) * scale);
	coef.c3 = vec2(coef.c3.y, -coef.c3.x) * (1. / (M_PI * 2. * 3.) * scale);
	coef.c4 = vec2(coef.c4.y, -coef.c4.x) * (1. / (M_PI * 2. * 4.) * scale);
	coef.c5 = vec2(coef.c5.y, -coef.c5.x) * (1. / (M_PI * 2. * 5.) * scale);
	coef.c6 = vec2(coef.c6.y, -coef.c6.x) * (1. / (M_PI * 2. * 6.) * scale);
	coef.c7 = vec2(coef.c7.y, -coef.c7.x) * (1. / (M_PI * 2. * 7.) * scale);
	return coef;
}

FomCoefs fomCoefScale(FomCoefs a, float v)
{
	return FomCoefs(
		a.c0 * v,
		a.c1 * v,
		a.c2 * v,
		a.c3 * v,
		a.c4 * v,
		a.c5 * v,
		a.c6 * v,
		a.c7 * v
	);
}

FomCoefs fomCoefSub(FomCoefs a, FomCoefs b)
{
	return FomCoefs(
		a.c0 - b.c0,
		a.c1 - b.c1,
		a.c2 - b.c2,
		a.c3 - b.c3,
		a.c4 - b.c4,
		a.c5 - b.c5,
		a.c6 - b.c6,
		a.c7 - b.c7
	);
}

float fomCoefDot(FomCoefs a, FomCoefs b)
{
	return a.c0 * b.c0 +
		dot(a.c1, b.c1) +
		dot(a.c2, b.c2) +
		dot(a.c3, b.c3) +
		dot(a.c4, b.c4) +
		dot(a.c5, b.c5) +
		dot(a.c6, b.c6) +
		dot(a.c7, b.c7);
}

/** s = fomCoefSub(fomCoefIntegrate(fomCoefImpulse(b)), fomCoefIntegrate(fomCoefImpulse(a))) and
 * range = b - a. */
float fomCoefDefiniteIntegrate(FomCoefs coefs, FomCoefs s, float range)
{
	return fomCoefDot(coefs, s) + range * coefs.c0 * 0.5;
}

