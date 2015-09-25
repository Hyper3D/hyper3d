uniform sampler2D u_texture;
varying highp vec2 v_texCoord;
uniform vec4 u_modulation;
void main()
{
	gl_FragColor = texture2D(u_texture, v_texCoord) * u_modulation;
}
