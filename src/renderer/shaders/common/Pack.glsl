vec2 pack16(highp float value) {
    value *= 255.;
    highp float flr = floor(value);
    return vec2(flr * (1. / 255.), value - flr);
}

highp float unpack16(vec2 packedValue) {
    return packedValue.x + packedValue.y * (1. / 255.);
}

vec3 pack24(highp float value) {
    value *= 256.;
    highp float i1 = floor(value);
    highp float f1 = value - i1;
    f1 *= 256.;
    highp float i2 = floor(f1);
    highp float f2 = f1 - i2;
    return vec3(i1 * (1. / 255.), i2 * (1. / 255.), f2);
}

highp float unpack24(vec3 packedValue) {
    return dot(packedValue, vec3(1., 1. / 256., 1. / 256. / 256.) * 255. / 256.);
}

vec4 pack32f(highp float value)
{
    highp float absValue = abs(value);
    if (absValue <= 1.e-16) {
        // underflow
        return vec4(0., 0., 0., 0.);
    } else {
        highp float exponent = ceil(log2(absValue));
        absValue *= exp2(-exponent);

        exponent += 63.; // bias
        if (value < 0.) {
            exponent += 128.; // sign
        }
        exponent *= 1. / 255.;

        return vec4(pack24(absValue), exponent);
    }
}

highp float unpack32f(vec4 p)
{
    if (p.w == 0.) {
        return 0.;
    } else {
        bool negative = false;
        highp float exponent = floor(p.w * 255. + 0.5 - 63.);
        if (exponent >= 128. - 63.) {
            // negative
            negative = true;
            exponent -= 128.;
        }

        highp float mantissa = unpack24(p.xyz);
        if (negative) {
            mantissa = -mantissa;
        }

        return mantissa * exp2(exponent);
    }
}

vec3 pack12x2(highp vec2 value)
{
    value *= 255.;
    highp vec2 flr = floor(value);
    highp vec2 frc = floor((value - flr) * 16.);
    return vec3(flr * (1. / 255.), dot(frc, vec2(1., 16.) / 255.));
}
highp vec2 unpack12x2(vec3 p)
{
    float yy = p.z * (255. / 16.);
    float yi = floor(yy);
    float yf = fract(yy);
    return p.xy + vec2(yf, yi) * vec2(1. / 255., 1. / 16. / 255.);
}