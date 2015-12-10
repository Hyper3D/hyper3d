
varying highp vec2 v_texCoord1;
varying highp vec4 v_texCoord2;

uniform sampler2D u_input;

void main()
{
	vec3 result = texture2D(u_input, v_texCoord1.xy).xyz;
	vec3 s;
	
	s = texture2D(u_input, vec2(v_texCoord1.x, v_texCoord2.y)).xyz;
	if (s.z > result.z) {
		result = s;
	}
	
	s = texture2D(u_input, vec2(v_texCoord1.x, v_texCoord2.w)).xyz;
	if (s.z > result.z) {
		result = s;
	}

	s = texture2D(u_input, vec2(v_texCoord2.x, v_texCoord1.y)).xyz;
	if (s.z > result.z) {
		result = s;
	}

	s = texture2D(u_input, vec2(v_texCoord2.z, v_texCoord1.y)).xyz;
	if (s.z > result.z) {
		result = s;
	}

	s = texture2D(u_input, v_texCoord2.xy).xyz;
	if (s.z > result.z) {
		result = s;
	}

	s = texture2D(u_input, v_texCoord2.xw).xyz;
	if (s.z > result.z) {
		result = s;
	}

	s = texture2D(u_input, v_texCoord2.zy).xyz;
	if (s.z > result.z) {
		result = s;
	}

	s = texture2D(u_input, v_texCoord2.zw).xyz;
	if (s.z > result.z) {
		result = s;
	}

	gl_FragColor = vec4(result, 0.);
}
