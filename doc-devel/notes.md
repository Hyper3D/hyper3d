Design Notes
===========

Shader Variable Name Conventions
---------------------------------

`x_theyLookLikeSomethingCase`

* Uniform `u_foo`.
  * Material parameter `foo` would be uniform `u_foo`.
* Vertex attribute named `bar` would be `a_bar`.
* Varying variable looks like `v_bar`.
  * If vertex attribute `a_foo` is to be used directly in the fragment shader, the corresponding varying would be `v_foo`.
* Shader parameter (NOT material parameter) looks like `c_someConstant`. Defined as preprocessor directive.
