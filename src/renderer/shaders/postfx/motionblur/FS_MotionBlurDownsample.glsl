#pragma require GBuffer
#pragma require Globals

#pragma parameter scale

varying highp vec2 v_texCoord;

uniform sampler2D u_g0;
uniform sampler2D u_g1;

uniform highp vec2 u_texCoordIncr;

uniform vec2 u_velocityScale;
uniform float u_amount;

// based on:
//
// Morgan McGuire, Padraic Hennessy, Michael Bukowski, and Brian Osman. 2012.
// A reconstruction filter for plausible motion blur. In Proceedings of the
// ACM SIGGRAPH Symposium on Interactive 3D Graphics and Games (I3D '12),
// Stephen N. Spencer (Ed.). ACM, New York, NY, USA, 135-142.
// DOI=10.1145/2159616.2159639 http://doi.acm.org/10.1145/2159616.2159639


void main()
{
    vec2 coords[c_scale];
    coords[0] = v_texCoord;
    for (int i = 1; i < c_scale; ++i) {
        coords[i] = coords[i - 1] + u_texCoordIncr;
        coords[i].y = min(coords[i].y,
            1. - u_globalDoubleInvRenderSize.y);
    }

    vec3 best = vec3(0.);
    for (int y = 0; y < c_scale; ++y) {
        for (int x = 0; x < c_scale; ++x) {
            vec2 coord = vec2(coords[x].x, coords[y].y);
            vec4 g0 = texture2D(u_g0, coord);
            vec4 g1 = texture2D(u_g1, coord);
            vec4 g2 = vec4(0.), g3 = vec4(0.);

            GBufferContents g;
            decodeGBuffer(g, g0, g1, g2, g3);

            g.velocity *= u_velocityScale * u_amount;
            vec3 vel = vec3(g.velocity, dot(g.velocity, g.velocity));
            if (vel.z > best.z) {
                best = vel;
            }
        }
    }

    if (best.z > 0.25) {
        best.xy *= inversesqrt(best.z) * 0.5;
    }
    best.z = length(best.xy) * 2.;

    best.xy += 0.5;
    gl_FragColor = vec4(best, 0.);
}
