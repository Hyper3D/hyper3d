
vec2 decodeVelocityMap(vec2 v)
{
    v = (v - 127. / 255.);

    return v * length(v);
}

vec2 encodeVelocityMap(vec2 v)
{
    v *= inversesqrt(length(v));
    return v + (127. / 255.);
}
