
// actually not using "log"

vec4 encodeLogRGB(vec3 rgb)
{
    float lum = max(max(rgb.r, rgb.g), rgb.b);
    float logval = min(floor(lum * 4. + 1.), 64.) * (1. / 4.);
    float invLogval = 1. / logval;
    return vec4(rgb * invLogval, logval * (1. / 16.));
}

vec3 decodeLogRGB(vec4 p)
{
    float t = floor(p.a * 64. + .5) * (1. / 4.);
    return p.rgb * t;
}
